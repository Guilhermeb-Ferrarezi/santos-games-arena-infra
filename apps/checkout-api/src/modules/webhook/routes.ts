import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { CheckoutApiEnv } from "../../config/env";
import type { OrderRepository } from "../checkout/order-repository";

// Chave pública do Abacate Pay usada para assinar todos os webhooks
const ABACATE_PAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", ABACATE_PAY_PUBLIC_KEY)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function registerWebhookRoutes(
  server: FastifyInstance,
  env: Pick<CheckoutApiEnv, "ABACATE_PAY_WEBHOOK_SECRET">,
  orders: OrderRepository
) {
  server.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    try {
      const json = JSON.parse((body as Buffer).toString());
      done(null, { raw: body as Buffer, json });
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  server.post("/webhook", async (request, reply) => {
    const { raw, json } = request.body as { raw: Buffer; json: unknown };

    // Verificar webhookSecret no query param (secret que registramos no Abacate Pay)
    const { webhookSecret } = request.query as { webhookSecret?: string };
    if (!webhookSecret) {
      return reply.code(401).send({ error: "missing_secret" });
    }
    const secretA = Buffer.from(webhookSecret);
    const secretB = Buffer.from(env.ABACATE_PAY_WEBHOOK_SECRET);
    if (
      secretA.length !== secretB.length ||
      !crypto.timingSafeEqual(secretA, secretB)
    ) {
      return reply.code(401).send({ error: "invalid_secret" });
    }

    // Verificar assinatura HMAC com a chave pública do Abacate Pay
    const signature = request.headers["x-webhook-signature"];
    if (typeof signature === "string") {
      const valid = verifyWebhookSignature(raw, signature);
      if (!valid) {
        return reply.code(401).send({ error: "invalid_signature" });
      }
    }

    const event = json as { event?: string; data?: { checkout?: { id?: string; status?: string } } };

    console.log("[webhook] received event", event?.event, event?.data?.checkout?.id, event?.data?.checkout?.status);

    const checkoutId = event?.data?.checkout?.id;
    const checkoutStatus = event?.data?.checkout?.status;

    if (checkoutId && checkoutStatus) {
      if (checkoutStatus === "PAID") {
        await orders.updateStatus(checkoutId, "paid");
      } else if (checkoutStatus === "EXPIRED") {
        await orders.updateStatus(checkoutId, "expired");
      } else if (checkoutStatus === "FAILED") {
        await orders.updateStatus(checkoutId, "failed");
      }
    }

    return reply.code(200).send({ ok: true });
  });
}
