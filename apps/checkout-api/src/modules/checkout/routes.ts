import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySessionToken } from "../../auth/verify-session-token";
import type { CheckoutApiEnv } from "../../config/env";
import type { AbacatePayClient } from "./abacate-pay-client";
import type { CustomerRepository } from "./customer-repository";
import type { OrderRepository } from "./order-repository";
import type { PayIntentStore } from "./pay-intent-store";
import type { PixStore } from "./pix-store";
import type { ProductRepository } from "./product-repository";

const createOrderBodySchema = z.object({
  productId: z.number().int().positive(),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email(),
    taxId: z.string().trim().min(11).max(14),
    cellphone: z.string().trim().min(10)
  }).optional()
});

export function registerCheckoutRoutes(
  server: FastifyInstance,
  env: Pick<CheckoutApiEnv, "JWT_SECRET" | "AUTH_COOKIE_NAME" | "CHECKOUT_WEB_URL">,
  orders: OrderRepository,
  customers: CustomerRepository,
  products: ProductRepository,
  abacatePay: AbacatePayClient,
  pixStore: PixStore,
  payIntentStore: PayIntentStore
) {
  server.get("/products", async () => {
    const list = await products.listActive();
    return { products: list };
  });

  server.get("/customer/me", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });

    const info = await customers.getInfo(session.userId);
    return { customer: info };
  });

  // ── Pay intent (link temporário via Redis) ────────────────────────────────
  server.post("/pay/intent", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });

    const { productId } = request.body as { productId?: unknown };
    const id = Number(productId);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: "invalid_product_id" });
    }

    const product = await products.findById(id);
    if (!product) return reply.code(404).send({ error: "product_not_found" });

    const intentToken = await payIntentStore.create(id);
    return reply.code(201).send({ token: intentToken });
  });

  server.get("/pay/intent/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const productId = await payIntentStore.get(token);
    if (!productId) return reply.code(404).send({ error: "intent_not_found" });

    const product = await products.findById(productId);
    if (!product) return reply.code(404).send({ error: "product_not_found" });

    await payIntentStore.remove(token);

    return { product };
  });

  server.post("/order", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const session = await verifySessionToken(token, env);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = createOrderBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const product = await products.findById(parsed.data.productId);
    if (!product) {
      return reply.code(404).send({ error: "product_not_found" });
    }

    const order = await orders.create({
      userId: session.userId,
      productId: String(product.id),
      description: product.name,
      amountCents: product.amountCents
    });

    const customer = parsed.data.customer
      ? {
          name: parsed.data.customer.name,
          email: parsed.data.customer.email,
          taxId: parsed.data.customer.taxId.replace(/\D/g, ""),
          cellphone: parsed.data.customer.cellphone
        }
      : undefined;

    const pix = await abacatePay.createTransparentPix({
      amountCents: product.amountCents,
      description: product.name,
      customer
    });

    if (!pix.ok) {
      return reply.code(502).send({ error: "pix_failed", message: pix.error });
    }

    await orders.updateBilling(order.id, pix.pixId, null);
    await pixStore.save(order.id, {
      brCode: pix.brCode,
      brCodeBase64: pix.brCodeBase64,
      expiresAt: pix.expiresAt
    });

    if (customer) {
      await customers.saveInfo(session.userId, {
        name: customer.name,
        taxId: customer.taxId,
        cellphone: customer.cellphone
      });
    }

    return reply.code(201).send({
      orderId: order.id,
      amountCents: product.amountCents,
      status: "pending",
      pixCode: pix.brCode,
      pixCodeBase64: pix.brCodeBase64,
      pixExpiresAt: pix.expiresAt
    });
  });

  server.delete("/order/:id", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });

    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });

    const { id } = request.params as { id: string };
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return reply.code(400).send({ error: "invalid_id" });

    const cancelled = await orders.cancelById(orderId, session.userId);
    if (!cancelled) return reply.code(404).send({ error: "not_found" });

    await pixStore.remove(orderId);
    return { ok: true };
  });

  server.get("/order/:id", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const session = await verifySessionToken(token, env);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const { id } = request.params as { id: string };
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const order = await orders.findById(orderId, session.userId);
    if (!order) {
      return reply.code(404).send({ error: "not_found" });
    }

    const pixData = order.status === "pending" ? await pixStore.get(orderId) : null;

    return {
      id: order.id,
      productId: order.productId,
      description: order.description,
      amountCents: order.amountCents,
      status: order.status,
      pixCode: pixData?.brCode ?? null,
      pixCodeBase64: pixData?.brCodeBase64 ?? null,
      pixExpiresAt: pixData?.expiresAt ?? null,
      createdAt: order.createdAt
    };
  });
}
