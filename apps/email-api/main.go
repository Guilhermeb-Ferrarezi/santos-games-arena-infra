package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/resend/resend-go/v2"
)

var (
	rc        *resend.Client
	fromEmail string
	apiSecret string
)

func main() {
	apiSecret = mustEnv("API_SECRET")
	fromEmail = mustEnv("RESEND_FROM")
	rc = resend.NewClient(mustEnv("RESEND_API_KEY"))

	port := getEnv("PORT", "3005")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "service": "email-api"})
	})
	mux.HandleFunc("POST /api/emails/welcome", auth(welcomeHandler))
	mux.HandleFunc("POST /api/emails/login-notification", auth(loginNotificationHandler))
	mux.HandleFunc("POST /api/emails/password-reset", auth(passwordResetHandler))
	mux.HandleFunc("POST /api/emails/password-changed", auth(passwordChangedHandler))
	mux.HandleFunc("POST /api/emails/email-change-confirmation", auth(emailChangeConfirmationHandler))

	slog.Info("email-api listening", "port", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

// ── Middleware ─────────────────────────────────────────────────────────────────

func auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != apiSecret {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

// ── Handlers ───────────────────────────────────────────────────────────────────

func welcomeHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To    string `json:"to"`
		Login string `json:"login"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Bem-vindo à Santos Games Arena, "+body.Login+"!", tmplWelcome(body.Login))
	respond(w, err)
}

func loginNotificationHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To        string `json:"to"`
		Login     string `json:"login"`
		IP        string `json:"ip"`
		UserAgent string `json:"userAgent"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Novo acesso detectado — Santos Games Arena", tmplLoginNotification(body.Login, body.IP, body.UserAgent))
	respond(w, err)
}

func passwordResetHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To       string `json:"to"`
		ResetURL string `json:"resetUrl"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Redefinição de senha — Santos Games Arena", tmplPasswordReset(body.ResetURL))
	respond(w, err)
}

func passwordChangedHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To    string `json:"to"`
		Login string `json:"login"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Senha alterada — Santos Games Arena", tmplPasswordChanged(body.Login))
	respond(w, err)
}

func emailChangeConfirmationHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To         string `json:"to"`
		Login      string `json:"login"`
		ConfirmURL string `json:"confirmUrl"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Confirme seu novo e-mail — Santos Games Arena", tmplEmailChangeConfirmation(body.Login, body.ConfirmURL))
	respond(w, err)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

func send(to, subject, html string) error {
	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    html,
	}
	_, err := rc.Emails.Send(params)
	return err
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return false
	}
	return true
}

func respond(w http.ResponseWriter, err error) {
	if err != nil {
		slog.Error("send error", "err", err)
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("missing required env var", "key", key)
		os.Exit(1)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
