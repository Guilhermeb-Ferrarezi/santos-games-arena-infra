import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySessionToken } from "../../auth/verify-session-token";
import type { CheckoutApiEnv } from "../../config/env";
import type { AbacatePayClient } from "./abacate-pay-client";
import type { CustomerRepository } from "./customer-repository";
import type { OrderRepository } from "./order-repository";
import type { ProductRepository } from "./product-repository";

const createOrderBodySchema = z.object({
  productId: z.number().int().positive()
});

export function registerCheckoutRoutes(
  server: FastifyInstance,
  env: Pick<CheckoutApiEnv, "JWT_SECRET" | "AUTH_COOKIE_NAME" | "CHECKOUT_WEB_URL">,
  orders: OrderRepository,
  customers: CustomerRepository,
  products: ProductRepository,
  abacatePay: AbacatePayClient
) {
  server.get("/products", async () => {
    const list = await products.listActive();
    return { products: list };
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

    let customerId = await customers.findByUserId(session.userId);

    if (!customerId) {
      const result = await abacatePay.createCustomer({
        name: session.login,
        email: session.email
      });

      if (!result.ok) {
        return reply.code(502).send({ error: "customer_failed", message: result.error });
      }

      customerId = result.customerId;
      await customers.save(session.userId, customerId, session.login, session.email);
    }

    const order = await orders.create({
      userId: session.userId,
      productId: String(product.id),
      description: product.name,
      amountCents: product.amountCents
    });

    const completionUrl = env.CHECKOUT_WEB_URL
      ? `${env.CHECKOUT_WEB_URL}/order/${order.id}`
      : undefined;

    const returnUrl = env.CHECKOUT_WEB_URL ?? undefined;

    const billing = await abacatePay.createBilling({
      customerId,
      products: [
        {
          externalId: String(product.id),
          name: product.name,
          description: product.description,
          quantity: 1,
          price: product.amountCents
        }
      ],
      completionUrl,
      returnUrl
    });

    if (!billing.ok) {
      return reply.code(502).send({ error: "billing_failed", message: billing.error });
    }

    await orders.updateBilling(order.id, billing.billingId, billing.checkoutUrl);

    return reply.code(201).send({
      orderId: order.id,
      checkoutUrl: billing.checkoutUrl,
      amountCents: billing.amountCents,
      status: "pending"
    });
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

    return {
      id: order.id,
      productId: order.productId,
      description: order.description,
      amountCents: order.amountCents,
      status: order.status,
      checkoutUrl: order.checkoutUrl,
      createdAt: order.createdAt
    };
  });
}
