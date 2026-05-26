import type { CheckoutApiEnv } from "../../config/env";

export type CreateChargeInput = {
  amountCents: number;
  description: string;
  expiresIn?: number;
  customer?: {
    name: string;
    email: string;
    taxId: string;
    phone: string;
  };
  webhookUrl?: string;
};

export type CreateChargeResult =
  | {
      ok: true;
      chargeId: string;
      correlationId: string;
      qrCode: string;
      qrCodeImage: string;
      paymentLink: string;
      expiresAt: string;
      valueCents: number;
    }
  | { ok: false; error: string };

export type DotfyClient = ReturnType<typeof createDotfyClient>;

export function createDotfyClient(
  env: Pick<CheckoutApiEnv, "DOTFY_API_KEY" | "DOTFY_API_URL">
) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DOTFY_API_KEY}`
  };

  async function createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const response = await fetch(`${env.DOTFY_API_URL}/api/charges`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        value: input.amountCents / 100,
        description: input.description,
        expiresIn: input.expiresIn ?? 3600,
        ...(input.customer
          ? {
              customer: {
                name: input.customer.name,
                email: input.customer.email,
                taxID: input.customer.taxId,
                phone: input.customer.phone
              }
            }
          : {}),
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {})
      })
    });

    const json = (await response.json()) as {
      success?: boolean;
      data?: {
        id: string;
        correlationID: string;
        qrCode: string;
        qrCodeImage: string;
        paymentLink: string;
        expiresAt: string;
        value: number;
      };
      error?: string;
    };

    console.log("[dotfy] charge response", response.status, json.error ?? "ok");

    if (!response.ok || json.error || !json.data) {
      return { ok: false, error: json.error ?? `HTTP ${response.status}` };
    }

    return {
      ok: true,
      chargeId: json.data.id,
      correlationId: json.data.correlationID,
      qrCode: json.data.qrCode,
      qrCodeImage: json.data.qrCodeImage,
      paymentLink: json.data.paymentLink,
      expiresAt: json.data.expiresAt,
      valueCents: json.data.value
    };
  }

  async function cancelCharge(chargeId: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${env.DOTFY_API_URL}/api/charges/${chargeId}`, {
      method: "DELETE",
      headers
    });

    console.log("[dotfy] cancel charge response", res.status);

    if (res.ok) return { ok: true };

    if (res.status === 404 || res.status === 405) {
      const patchRes = await fetch(`${env.DOTFY_API_URL}/api/charges/${chargeId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "EXPIRED" })
      });

      console.log("[dotfy] expire charge fallback response", patchRes.status);
      if (patchRes.ok) return { ok: true };
    }

    return { ok: false, error: `HTTP ${res.status}` };
  }

  return { createCharge, cancelCharge };
}
