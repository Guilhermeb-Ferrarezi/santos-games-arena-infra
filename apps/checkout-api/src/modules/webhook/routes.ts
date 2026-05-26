import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { CheckoutApiEnv } from "../../config/env";
import type { OrderRepository } from "../checkout/order-repository";

function verifyDotfySignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    })
  );

  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function registerWebhookRoutes(
  server: FastifyInstance,
  env: Pick<CheckoutApiEnv, "DOTFY_WEBHOOK_SECRET">,
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
    if (typeof signature !== "string" || !signature) {
      return reply.code(401).send({ error: "missing_signature" });
    }

    const valid = verifyDotfySignature(raw, signature, env.DOTFY_WEBHOOK_SECRET);
    if (!valid) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    const event = json as {
      event?: string;
      timestamp?: string;
      data?: {
        id?: string;
        externalId?: string | null;
        status?: string;
      };
    };

    const eventName = event?.event ?? "";
    const chargeId = event?.data?.id;
    const rawStatus = event?.data?.status;

    console.log("[webhook] received event", eventName, chargeId, rawStatus);

    if (chargeId) {
      if (eventName === "EVENT:CHARGE_PAID" || rawStatus === "PAID") {
        await orders.updateStatus(chargeId, "paid");
      } else if (eventName === "EVENT:CHARGE_EXPIRED" || rawStatus === "EXPIRED") {
        await orders.updateStatus(chargeId, "expired");
      }
    }

    return reply.code(200).send({});
  });
}
