package main

import "fmt"

func esc(s string) string {
	r := ""
	for _, c := range s {
		switch c {
		case '&':
			r += "&amp;"
		case '<':
			r += "&lt;"
		case '>':
			r += "&gt;"
		case '"':
			r += "&quot;"
		case '\'':
			r += "&#39;"
		default:
			r += string(c)
		}
	}
	return r
}

func layout(content string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Santos Games Arena</title>
</head>
<body style="margin:0;padding:0;background:#06070a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#06070a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <img src="https://cdn.santos-games.com/emails/sga-logo.png" alt="Santos Games Arena"
                height="26" style="display:block;height:26px;width:auto;"/>
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.25);">ARENA</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0e0f14;border:1px solid rgba(255,255,255,0.07);border-radius:2px;">
          %s
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:1px;">
            © 2026 Santos Games Arena · santos-games.com
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.15);">
            Este e-mail foi enviado porque sua conta realizou uma ação na plataforma.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`, content)
}

func badge(text, color string) string {
	return fmt.Sprintf(
		`<span style="display:inline-block;background:%s22;color:%s;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border:1px solid %s44;border-radius:2px;">%s</span>`,
		color, color, color, esc(text),
	)
}

func ctaButton(href, label string) string {
	return fmt.Sprintf(
		`<a href="%s" style="display:inline-block;background:#f86d83;color:#fff;text-decoration:none;padding:14px 32px;font-size:12px;font-weight:900;letter-spacing:3px;text-transform:uppercase;border-radius:2px;">%s</a>`,
		esc(href), esc(label),
	)
}

func divider() string {
	return `<div style="margin:24px 32px;height:1px;background:rgba(255,255,255,0.06);"></div>`
}

func section(content string) string {
	return fmt.Sprintf(`<div style="padding:32px 32px 0;">%s</div>`, content)
}

func cardFooter(content string) string {
	return fmt.Sprintf(`<div style="padding:20px 32px 28px;background:rgba(0,0,0,0.2);">%s</div>`, content)
}

func infoTable(rows [][2]string) string {
	html := `<table width="100%%" cellpadding="0" cellspacing="0">`
	for _, row := range rows {
		html += fmt.Sprintf(`<tr>
  <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
    <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;">%s</span>
  </td>
  <td style="padding:8px 0 8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-family:monospace;">%s</span>
  </td>
</tr>`, esc(row[0]), esc(row[1]))
	}
	html += `</table>`
	return html
}

// ── Templates ─────────────────────────────────────────────────────────────────

func tmplWelcome(login string) string {
	return layout(
		section(fmt.Sprintf(`
<p style="margin:0 0 8px;">%s</p>
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Bem-vindo, %s!</h1>
<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
  Sua conta na <strong style="color:#fff;">Santos Games Arena</strong> foi criada com sucesso.
  Você agora faz parte da principal comunidade de e-sports da região.
</p>`, badge("Novo na Arena", "#f86d83"), esc(login)))+
			divider()+
			`<div style="padding:0 32px;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
    <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%%;">
      <p style="margin:0 0 4px;font-size:18px;">🏆</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Campeonatos</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Compete em CS2, Valorant e LoL</p>
    </td>
    <td style="width:8px;"></td>
    <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%%;">
      <p style="margin:0 0 4px;font-size:18px;">📊</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Ranking</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Suba no ranking regional</p>
    </td>
    <td style="width:8px;"></td>
    <td style="padding:16px;background:rgba(248,109,131,0.06);border:1px solid rgba(248,109,131,0.15);border-radius:2px;vertical-align:top;width:33%%;">
      <p style="margin:0 0 4px;font-size:18px;">👥</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">Comunidade</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">Conecte-se com outros jogadores</p>
    </td>
  </tr></table>
</div>`+
			cardFooter(`<p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.35);">Pronto para competir?</p>`+
				ctaButton("https://santos-games.com", "Explorar a Arena")),
	)
}

func tmplLoginNotification(login, ip, userAgent string) string {
	rows := [][2]string{}
	if ip != "" {
		rows = append(rows, [2]string{"IP", ip})
	}
	device := userAgent
	if len(device) > 80 {
		device = device[:80]
	}
	if device == "" {
		device = "Dispositivo desconhecido"
	}
	rows = append(rows, [2]string{"Dispositivo", device})

	return layout(
		section(fmt.Sprintf(`
<p style="margin:0 0 8px;">%s</p>
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Novo acesso à sua conta</h1>
<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
  Um novo acesso foi realizado na conta <strong style="color:#fff;">%s</strong>.
</p>`, badge("Aviso de Segurança", "#f8a84d"), esc(login)))+
			divider()+
			fmt.Sprintf(`<div style="padding:0 32px 24px;">%s</div>`, infoTable(rows))+
			cardFooter(
				`<p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">Se não foi você, revogue as sessões ativas imediatamente.</p>`+
					ctaButton("https://santos-games.com/settings?tab=sessoes", "Ver sessões ativas"),
			),
	)
}

func tmplPasswordReset(resetURL string) string {
	return layout(
		section(fmt.Sprintf(`
<p style="margin:0 0 8px;">%s</p>
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Redefinição de senha</h1>
<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
  Recebemos uma solicitação para redefinir a senha da sua conta.
  O link abaixo expira em <strong style="color:#fff;">15 minutos</strong>.
</p>`, badge("Segurança", "#f86d83")))+
			divider()+
			cardFooter(
				ctaButton(resetURL, "Redefinir senha")+
					`<p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
  Se você não solicitou isso, ignore este e-mail — nenhuma alteração será feita.
</p>`,
			),
	)
}

func tmplPasswordChanged(login string) string {
	return layout(
		section(fmt.Sprintf(`
<p style="margin:0 0 8px;">%s</p>
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Senha alterada</h1>
<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
  A senha da conta <strong style="color:#fff;">%s</strong> foi alterada com sucesso.
</p>`, badge("Segurança", "#f86d83"), esc(login)))+
			divider()+
			cardFooter(
				`<p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">Se não foi você, acesse a plataforma e altere sua senha imediatamente.</p>`+
					ctaButton("https://santos-games.com/settings", "Acessar configurações"),
			),
	)
}

func tmplEmailChangeConfirmation(login, confirmURL string) string {
	return layout(
		section(fmt.Sprintf(`
<p style="margin:0 0 8px;">%s</p>
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Confirme seu novo e-mail</h1>
<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
  Recebemos uma solicitação para associar este endereço à conta <strong style="color:#fff;">%s</strong>.
  O link expira em <strong style="color:#fff;">30 minutos</strong>.
</p>`, badge("Confirmação", "#f86d83"), esc(login)))+
			divider()+
			cardFooter(
				ctaButton(confirmURL, "Confirmar novo e-mail")+
					`<p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
  Se você não solicitou isso, ignore este e-mail.
</p>`,
			),
	)
}
