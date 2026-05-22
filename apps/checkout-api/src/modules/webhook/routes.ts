import type { FastifyInstance } from "fastify";
import type { CheckoutApiEnv } from "../../config/env";
import type { OrderRepository } from "../checkout/order-repository";

const encoder = new TextEncoder();

async function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, rawBody);
  const expected = Buffer.from(mac).toString("base64");

  if (expected.length !== signature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return result === 0;
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

    const signature = request.headers["x-webhook-signature"];
    if (typeof signature !== "string") {
      return reply.code(401).send({ error: "missing_signature" });
    }

    const valid = await verifyWebhookSignature(raw, signature, env.ABACATE_PAY_WEBHOOK_SECRET);
    if (!valid) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    const event = json as { event?: string; data?: { checkout?: { id?: string; status?: string } } };

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
