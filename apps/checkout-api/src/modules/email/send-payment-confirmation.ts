import { Resend } from "resend";
import type { CheckoutApiEnv } from "../../config/env";

let resend: Resend | null = null;

export function initResend(env: Pick<CheckoutApiEnv, "RESEND_API_KEY">) {
  if (env.RESEND_API_KEY) {
    resend = new Resend(env.RESEND_API_KEY);
  }
}

export async function sendPaymentConfirmation(
  env: Pick<CheckoutApiEnv, "RESEND_FROM">,
  to: string,
  order: { id: number; description: string; amountCents: number }
): Promise<void> {
  if (!resend) return;

  const valor = (order.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  try {
    await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject: `Pagamento confirmado — Pedido #${order.id}`,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="color:#e5303a;font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0">
        Santos Games
      </h1>
    </div>

    <div style="background:#111;border:1px solid #222;padding:32px 24px;text-align:center">
      <div style="display:inline-block;background:#16a34a;color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 12px;margin-bottom:16px">
        Pagamento confirmado
      </div>

      <h2 style="color:#fff;font-size:20px;font-weight:700;margin:16px 0 8px">${order.description}</h2>
      <p style="color:#e5303a;font-size:32px;font-weight:900;margin:8px 0">${valor}</p>
      <p style="color:#888;font-size:13px;margin:4px 0">Pedido #${order.id}</p>
    </div>

    <p style="color:#666;font-size:12px;text-align:center;margin-top:24px">
      Este email foi enviado automaticamente. Em caso de dúvidas, entre em contato pelo WhatsApp.
    </p>
  </div>
</body>
</html>`
    });
    console.log("[email] payment confirmation sent to", to);
  } catch (err) {
    console.warn("[email] failed to send payment confirmation:", err);
  }
}
