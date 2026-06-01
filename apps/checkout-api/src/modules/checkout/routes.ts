import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySessionToken } from "../../auth/verify-session-token";
import type { CheckoutApiEnv } from "../../config/env";
import type { CouponRepository } from "./coupon-repository";
import type { CustomerRepository } from "./customer-repository";
import type { DotfyClient } from "./dotfy-client";
import type { OrderRepository } from "./order-repository";
import type { PayIntentStore } from "./pay-intent-store";
import type { PixStore } from "./pix-store";
import type { ProductRepository } from "./product-repository";

const createOrderBodySchema = z.object({
  productId: z.number().int().positive(),
  method: z.enum(["pix", "card"]).default("pix"),
  saveInfo: z.boolean().default(true),
  couponCode: z.string().trim().optional(),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email(),
    taxId: z.string().trim().min(11).max(14),
    cellphone: z.string().trim().min(10)
  }).optional(),
});

function applyDiscounts(baseCents: number, productDiscountPercent: number | null, couponPercent: number | null): number {
  let amount = baseCents;
  if (productDiscountPercent) amount = Math.round(amount * (1 - productDiscountPercent / 100));
  if (couponPercent) amount = Math.round(amount * (1 - couponPercent / 100));
  return Math.max(amount, 0);
}

export function registerCheckoutRoutes(
  server: FastifyInstance,
  env: Pick<CheckoutApiEnv, "JWT_SECRET" | "AUTH_COOKIE_NAME" | "CHECKOUT_WEB_URL">,
  orders: OrderRepository,
  customers: CustomerRepository,
  products: ProductRepository,
  coupons: CouponRepository | undefined,
  dotfy: DotfyClient,
  pixStore: PixStore,
  payIntentStore: PayIntentStore
) {
  server.get("/products", async () => {
    const list = await products.listActive();
    return { products: list };
  });

  server.get("/product/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const productId = parseInt(id, 10);
    if (isNaN(productId) || productId <= 0) return reply.code(400).send({ error: "invalid_id" });
    const product = await products.findById(productId);
    if (!product) return reply.code(404).send({ error: "product_not_found" });
    return { product };
  });

  server.get("/coupon/validate", async (request, reply) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });

    const { code } = request.query as { code?: string };
    if (!code?.trim()) return reply.code(400).send({ error: "missing_code" });

    if (!coupons) return reply.code(404).send({ valid: false, message: "Cupom inválido." });

    const coupon = await coupons.findActiveByCode(code.trim());
    if (!coupon) {
      return reply.code(404).send({ valid: false, message: "Cupom inválido ou expirado." });
    }

    return { valid: true, discountPercent: coupon.discount_percent, code: coupon.code };
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

  // GET /pay/intent/:token — pre-populates the checkout page with product info.
  // This is intentionally idempotent: the token expires via Redis TTL, so
  // repeated reads (prefetchers, page refreshes) do not invalidate the intent.
  server.get("/pay/intent/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const productId = await payIntentStore.get(token);
    if (!productId) return reply.code(404).send({ error: "intent_not_found" });

    const product = await products.findById(productId);
    if (!product) return reply.code(404).send({ error: "product_not_found" });

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

    let couponRow = null;
    if (parsed.data.couponCode && coupons) {
      couponRow = await coupons.findActiveByCode(parsed.data.couponCode);
      if (!couponRow) {
        return reply.code(400).send({ error: "invalid_coupon", message: "Cupom inválido ou expirado." });
      }
    }

    const couponPercent = couponRow?.discount_percent ?? null;
    const finalAmountCents = applyDiscounts(product.amountCents, product.discountPercent, couponPercent);
    const discountCents = product.amountCents - finalAmountCents;

    const order = await orders.create({
      userId: session.userId,
      productId: String(product.id),
      description: product.name,
      amountCents: finalAmountCents,
      originalAmountCents: product.amountCents,
      couponCode: couponRow?.code ?? null,
      discountCents: discountCents > 0 ? discountCents : null,
      paymentMethod: parsed.data.method
    });

    if (couponRow && coupons) {
      await coupons.incrementUsage(couponRow.id);
    }

    const customer = parsed.data.customer
      ? {
          name: parsed.data.customer.name,
          email: parsed.data.customer.email,
          taxId: parsed.data.customer.taxId.replace(/\D/g, ""),
          phone: parsed.data.customer.cellphone
        }
      : undefined;

    const charge = await dotfy.createCharge({
      amountCents: finalAmountCents,
      description: product.name,
      customer
    });

    if (!charge.ok) {
      await orders.failById(order.id);
      return reply.code(502).send({ error: "charge_failed", message: charge.error });
    }

    await orders.updateCharge(order.id, charge.chargeId, charge.paymentLink);

    if (parsed.data.method === "card") {
      if (parsed.data.customer && parsed.data.saveInfo) {
        await customers.saveInfo(session.userId, {
          name: parsed.data.customer.name,
          taxId: parsed.data.customer.taxId.replace(/\D/g, ""),
          cellphone: parsed.data.customer.cellphone,
          email: session.email,
          login: session.login
        });
      }

      return reply.code(201).send({
        orderId: order.id,
        amountCents: finalAmountCents,
        status: "pending",
        checkoutUrl: charge.paymentLink
      });
    }

    await pixStore.save(order.id, {
      brCode: charge.qrCode,
      brCodeBase64: charge.qrCodeImage,
      expiresAt: charge.expiresAt
    });

    if (parsed.data.customer && parsed.data.saveInfo) {
      await customers.saveInfo(session.userId, {
        name: parsed.data.customer.name,
        taxId: parsed.data.customer.taxId.replace(/\D/g, ""),
        cellphone: parsed.data.customer.cellphone,
        email: session.email,
        login: session.login
      });
    }

    return reply.code(201).send({
      orderId: order.id,
      amountCents: finalAmountCents,
      status: "pending",
      pixCode: charge.qrCode,
      pixCodeBase64: charge.qrCodeImage,
      pixExpiresAt: charge.expiresAt
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

    const order = await orders.findById(orderId, session.userId);
    if (!order || order.status !== "pending") return reply.code(404).send({ error: "not_found" });

    const cancelled = await orders.cancelById(orderId, session.userId);
    if (!cancelled) return reply.code(404).send({ error: "not_found" });

    if (order.chargeId) {
      const result = await dotfy.cancelCharge(order.chargeId);
      if (!result.ok) {
        console.warn("[checkout] dotfy charge cancel failed:", result.error);
      }
    }

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
