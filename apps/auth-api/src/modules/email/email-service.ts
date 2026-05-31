import { Resend } from "resend";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeUrl(url: string, baseUrl: string): string {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== base.hostname) {
      throw new Error("invalid");
    }
    return url;
  } catch {
    return "#";
  }
}

export type EmailService = {
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
  sendLoginNotification(to: string, login: string, ip: string | null, userAgent: string | null): Promise<void>;
  sendPasswordChanged(to: string, login: string): Promise<void>;
  sendEmailChangeConfirmation(to: string, login: string, confirmUrl: string): Promise<void>;
};

export function createEmailService(apiKey: string, fromEmail: string, appBaseUrl?: string): EmailService {
  const resend = new Resend(apiKey);

  async function send(to: string, subject: string, html: string) {
    await resend.emails.send({ from: fromEmail, to, subject, html });
  }

  const header = `<div style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Santos<span style="color:#f86d83">.</span>Games</div>`;
  const wrap = (content: string) => `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#06070a;color:#fff;padding:32px;border:1px solid rgba(255,255,255,0.08)">${header}${content}</div>`;

  return {
    async sendPasswordReset(to, resetUrl) {
      const safeHref = appBaseUrl ? safeUrl(resetUrl, appBaseUrl) : esc(resetUrl);
      await send(to, "Redefinição de senha — Santos Games Arena", wrap(`
        <h2 style="font-size:18px;font-weight:700;margin:24px 0 8px">Redefinição de senha</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px">
          Recebemos uma solicitação para redefinir a senha da sua conta.
          O link abaixo é válido por <strong style="color:#fff">15 minutos</strong>.
        </p>
        <a href="${safeHref}" style="display:inline-block;background:#f86d83;color:#fff;text-decoration:none;padding:12px 28px;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:2px">
          Redefinir senha
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Se você não solicitou isso, ignore este e-mail. Nenhuma alteração foi feita.
        </p>
      `));
    },

    async sendLoginNotification(to, login, ip, userAgent) {
      const device = esc(userAgent ? userAgent.slice(0, 80) : "Dispositivo desconhecido");
      await send(to, "Novo acesso detectado — Santos Games Arena", wrap(`
        <h2 style="font-size:18px;font-weight:700;margin:24px 0 8px">Novo acesso à sua conta</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 16px">
          Um novo acesso foi realizado na conta <strong style="color:#fff">${esc(login)}</strong>.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);padding:16px;font-size:13px;color:rgba(255,255,255,0.7)">
          ${ip ? `<div><strong>IP:</strong> ${esc(ip)}</div>` : ""}
          <div><strong>Dispositivo:</strong> ${device}</div>
        </div>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Se não foi você, acesse as configurações e revogue as sessões ativas imediatamente.
        </p>
      `));
    },

    async sendEmailChangeConfirmation(to, login, confirmUrl) {
      const safeHref = esc(confirmUrl);
      await send(to, "Confirme a alteração de e-mail — Santos Games Arena", wrap(`
        <h2 style="font-size:18px;font-weight:700;margin:24px 0 8px">Confirme a alteração de e-mail</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 16px">
          Recebemos uma solicitação para alterar o e-mail da conta <strong style="color:#fff">${esc(login)}</strong>
          para este endereço. Clique no botão abaixo para confirmar.
          O link é válido por <strong style="color:#fff">30 minutos</strong>.
        </p>
        <a href="${safeHref}" style="display:inline-block;background:#f86d83;color:#fff;text-decoration:none;padding:12px 28px;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:2px">
          Confirmar novo e-mail
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Se você não solicitou isso, ignore este e-mail. Nenhuma alteração será feita.
        </p>
      `));
    },

    async sendPasswordChanged(to, login) {
      await send(to, "Senha alterada — Santos Games Arena", wrap(`
        <h2 style="font-size:18px;font-weight:700;margin:24px 0 8px">Senha alterada com sucesso</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 16px">
          A senha da conta <strong style="color:#fff">${esc(login)}</strong> foi alterada.
        </p>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Se não foi você, acesse a plataforma e altere sua senha imediatamente ou contate um administrador.
        </p>
      `));
    },
  };
}

export function createNoopEmailService(): EmailService {
  return {
    async sendPasswordReset() {},
    async sendLoginNotification() {},
    async sendPasswordChanged() {},
    async sendEmailChangeConfirmation() {},
  };
}
