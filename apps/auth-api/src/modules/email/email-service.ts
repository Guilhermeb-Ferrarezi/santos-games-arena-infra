import { Resend } from "resend";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export type EmailService = {
  sendWelcome(to: string, login: string): Promise<void>;
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
  sendLoginNotification(to: string, login: string, ip: string | null, userAgent: string | null): Promise<void>;
  sendPasswordChanged(to: string, login: string): Promise<void>;
  sendEmailChangeConfirmation(to: string, login: string, confirmUrl: string): Promise<void>;
  sendTwoFactorCode(to: string, login: string, code: string): Promise<void>;
};

// ─── Layout base ─────────────────────────────────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Santos Games Arena</title>
</head>
<body style="margin:0;padding:0;background-color:#06070a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06070a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://cdn.santos-games.com/emails/sga-logo.png" alt="Santos Games Arena" height="26" style="display:block;height:26px;width:auto;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.25);">ARENA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0e0f14;border:1px solid rgba(255,255,255,0.07);border-radius:2px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:1px;">
                © 2026 Santos Games Arena · santos-games.com
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.15);">
                Este e-mail foi enviado para você porque sua conta realizou uma ação na plataforma.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function cardSection(content: string): string {
  return `<div style="padding:32px 32px 0;">${content}</div>`;
}

function divider(): string {
  return `<div style="margin:24px 32px;height:1px;background:rgba(255,255,255,0.06);"></div>`;
}

function cardFooter(content: string): string {
  return `<div style="padding:20px 32px 28px;background:rgba(0,0,0,0.2);">${content}</div>`;
}

function badge(text: string, color = "#f86d83"): string {
  return `<span style="display:inline-block;background:${color}22;color:${color};font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border:1px solid ${color}44;border-radius:2px;">${esc(text)}</span>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f86d83;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:12px;font-weight:900;letter-spacing:3px;text-transform:uppercase;border-radius:2px;">${esc(label)}</a>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;">${esc(label)}</span>
    </td>
    <td style="padding:8px 0 8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:12px;color:rgba(255,255,255,0.7);font-family:monospace;">${esc(value)}</span>
    </td>
  </tr>`;
}

// ─── Service factory ──────────────────────────────────────────────────────────

export function createEmailService(apiKey: string, fromEmail: string, _appBaseUrl?: string): EmailService {
  const resend = new Resend(apiKey);
  const from = fromEmail.includes("<") ? fromEmail : `Santos Games <${fromEmail}>`;

  async function send(to: string, subject: string, html: string) {
    await resend.emails.send({ from, to, subject, html });
  }

  return {
    async sendWelcome(to, login) {
      await send(to, `Bem-vindo à Santos Games Arena, ${login}!`, emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Novo na Arena")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Bem-vindo, ${esc(login)}!
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            Sua conta na <strong style="color:#fff;">Santos Games Arena</strong> foi criada com sucesso.
            Você agora faz parte da principal comunidade de e-sports da região.
          </p>
        `)}
        ${divider()}
        <div style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%;">
                <p style="margin:0 0 4px;font-size:18px;">🏆</p>
                <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Campeonatos</p>
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Compete em CS2, Valorant e LoL</p>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%;">
                <p style="margin:0 0 4px;font-size:18px;">📊</p>
                <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Ranking</p>
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Suba no ranking regional</p>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%;">
                <p style="margin:0 0 4px;font-size:18px;">👥</p>
                <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Comunidade</p>
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Conecte-se com outros jogadores</p>
              </td>
            </tr>
          </table>
        </div>
        ${cardFooter(`
          <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.35);">Pronto para competir?</p>
          ${ctaButton("https://santos-games.com", "Explorar a Arena")}
        `)}
      `));
    },

    async sendPasswordReset(to, resetUrl) {
      await send(to, "Redefinição de senha — Santos Games Arena", emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Segurança")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Redefinição de senha
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            Recebemos uma solicitação para redefinir a senha da sua conta.
            O link abaixo expira em <strong style="color:#fff;">15 minutos</strong>.
          </p>
        `)}
        ${divider()}
        ${cardFooter(`
          ${ctaButton(esc(resetUrl), "Redefinir senha")}
          <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
            Se você não solicitou isso, ignore este e-mail — nenhuma alteração será feita.<br/>
            O link expira automaticamente após 15 minutos.
          </p>
        `)}
      `));
    },

    async sendLoginNotification(to, login, ip, userAgent) {
      const device = userAgent ? userAgent.slice(0, 80) : "Dispositivo desconhecido";
      await send(to, "Novo acesso detectado — Santos Games Arena", emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Aviso de Segurança", "#f8a84d")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Novo acesso à sua conta
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            Um novo acesso foi realizado na conta <strong style="color:#fff;">${esc(login)}</strong>.
          </p>
        `)}
        ${divider()}
        <div style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${ip ? infoRow("IP", ip) : ""}
            ${infoRow("Dispositivo", device)}
          </table>
        </div>
        ${cardFooter(`
          <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">
            Se não foi você, revogue as sessões ativas imediatamente.
          </p>
          ${ctaButton("https://santos-games.com/settings?tab=sessoes", "Ver sessões ativas")}
        `)}
      `));
    },

    async sendPasswordChanged(to, login) {
      await send(to, "Senha alterada — Santos Games Arena", emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Segurança")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Senha alterada
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            A senha da conta <strong style="color:#fff;">${esc(login)}</strong> foi alterada com sucesso.
          </p>
        `)}
        ${divider()}
        ${cardFooter(`
          <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">
            Se não foi você, acesse a plataforma e altere sua senha imediatamente.
          </p>
          ${ctaButton("https://santos-games.com/settings", "Acessar configurações")}
        `)}
      `));
    },

    async sendEmailChangeConfirmation(to, login, confirmUrl) {
      await send(to, "Confirme seu novo e-mail — Santos Games Arena", emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Confirmação")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Confirme seu novo e-mail
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            Recebemos uma solicitação para associar este endereço à conta
            <strong style="color:#fff;">${esc(login)}</strong>.
            Clique abaixo para confirmar. O link expira em <strong style="color:#fff;">30 minutos</strong>.
          </p>
        `)}
        ${divider()}
        ${cardFooter(`
          ${ctaButton(esc(confirmUrl), "Confirmar novo e-mail")}
          <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
            Se você não solicitou isso, ignore este e-mail — nenhuma alteração será feita.
          </p>
        `)}
      `));
    },

    async sendTwoFactorCode(to, login, code) {
      await send(to, `Seu código de verificação — Santos Games Arena`, emailLayout(`
        ${cardSection(`
          <p style="margin:0 0 8px;">${badge("Verificação 2FA", "#7c6af8")}</p>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Código de autenticação
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
            Olá, <strong style="color:#fff;">${esc(login)}</strong>. Use o código abaixo para concluir seu acesso. Ele expira em <strong style="color:#fff;">5 minutos</strong>.
          </p>
        `)}
        ${divider()}
        <div style="padding:0 32px 32px;text-align:center;">
          <div style="display:inline-block;background:rgba(124,106,248,0.08);border:1px solid rgba(124,106,248,0.3);border-radius:4px;padding:20px 40px;margin:8px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#fff;font-family:monospace;">${esc(code)}</span>
          </div>
          <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
            Se você não está tentando fazer login, ignore este e-mail e sua conta permanecerá segura.
          </p>
        </div>
      `));
    },
  };
}

export function createNoopEmailService(): EmailService {
  return {
    async sendWelcome() {},
    async sendPasswordReset() {},
    async sendLoginNotification() {},
    async sendPasswordChanged() {},
    async sendEmailChangeConfirmation() {},
    async sendTwoFactorCode() {},
  };
}

export function createHttpEmailService(baseUrl: string, secret: string): EmailService {
  const base = baseUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", "X-Api-Key": secret };

  async function post(path: string, body: Record<string, string | null>) {
    const r = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`email-api ${path} → ${r.status}`);
  }

  return {
    async sendWelcome(to, login) {
      await post("/api/emails/welcome", { to, login });
    },
    async sendPasswordReset(to, resetUrl) {
      await post("/api/emails/password-reset", { to, resetUrl });
    },
    async sendLoginNotification(to, login, ip, userAgent) {
      await post("/api/emails/login-notification", { to, login, ip: ip ?? "", userAgent: userAgent ?? "" });
    },
    async sendPasswordChanged(to, login) {
      await post("/api/emails/password-changed", { to, login });
    },
    async sendEmailChangeConfirmation(to, login, confirmUrl) {
      await post("/api/emails/email-change-confirmation", { to, login, confirmUrl });
    },
    async sendTwoFactorCode(to, login, code) {
      await post("/api/emails/two-factor-code", { to, login, code });
    },
  };
}
