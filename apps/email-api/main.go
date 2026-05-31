package main

import (
	"context"
	"embed"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/resend/resend-go/v2"
)

//go:embed dist
var staticFiles embed.FS

var (
	rc        *resend.Client
	fromEmail string
	apiSecret string
)

func main() {
	ctx := context.Background()

	apiSecret = mustEnv("API_SECRET")
	fromEmail = mustEnv("RESEND_FROM")
	rc = resend.NewClient(mustEnv("RESEND_API_KEY"))
	authServiceURL = getEnv("AUTH_URL", "https://auth.santos-games.com")

	initDB(ctx)
	go schedulerLoop(ctx)

	port := getEnv("PORT", "3005")

	mux := http.NewServeMux()

	// ── Public API ────────────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "service": "email-api"})
	})
	mux.HandleFunc("POST /api/emails/welcome", auth(welcomeHandler))
	mux.HandleFunc("POST /api/emails/login-notification", auth(loginNotificationHandler))
	mux.HandleFunc("POST /api/emails/password-reset", auth(passwordResetHandler))
	mux.HandleFunc("POST /api/emails/password-changed", auth(passwordChangedHandler))
	mux.HandleFunc("POST /api/emails/email-change-confirmation", auth(emailChangeConfirmationHandler))

	// ── Admin API (auth via sessão) ───────────────────────────────────────────
	mux.HandleFunc("GET /api/admin/stats",          adminAuth(adminStatsHandler))
	mux.HandleFunc("GET /api/admin/platform-users", adminAuth(adminPlatformUsersHandler))
	mux.HandleFunc("GET /api/admin/logs", adminAuth(adminLogsHandler))
	mux.HandleFunc("GET /api/admin/users", adminAuth(adminUsersHandler))
	mux.HandleFunc("GET /api/admin/templates",                  adminAuth(adminTemplatesHandler))
	mux.HandleFunc("POST /api/admin/templates",                 adminAuth(adminTemplateCreateHandler))
	mux.HandleFunc("GET /api/admin/templates/{name}",           adminAuth(adminTemplateGetHandler))
	mux.HandleFunc("PUT /api/admin/templates/{name}",           adminAuth(adminTemplateUpdateHandler))
	mux.HandleFunc("DELETE /api/admin/templates/{name}",        adminAuth(adminTemplateDeleteHandler))
	mux.HandleFunc("GET /api/admin/templates/{name}/preview",   adminAuth(adminTemplatePreviewHandler))
	mux.HandleFunc("POST /api/admin/templates/{name}/test",     adminAuth(adminTemplateTestHandler))
	mux.HandleFunc("GET /api/admin/scheduled", adminAuth(adminScheduledListHandler))
	mux.HandleFunc("POST /api/admin/scheduled", adminAuth(adminScheduledCreateHandler))
	mux.HandleFunc("DELETE /api/admin/scheduled/{id}", adminAuth(adminScheduledCancelHandler))

	// ── SPA ───────────────────────────────────────────────────────────────────
	distFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		slog.Error("failed to sub dist", "err", err)
		os.Exit(1)
	}
	fileServer := http.FileServer(http.FS(distFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		_, fsErr := fs.Stat(distFS, strings.TrimPrefix(r.URL.Path, "/"))
		if fsErr != nil {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	slog.Info("email-api listening", "port", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

// ── API key middleware ─────────────────────────────────────────────────────────

func auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != apiSecret {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

// ── Email handlers ────────────────────────────────────────────────────────────

func welcomeHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To    string `json:"to"`
		Login string `json:"login"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := send(body.To, "Bem-vindo à Santos Games Arena, "+body.Login+"!", tmplWelcome(body.Login))
	logAndRespond(w, err, "welcome", body.To, body.Login)
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
	logAndRespond(w, err, "login-notification", body.To, body.Login)
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
	logAndRespond(w, err, "password-reset", body.To, "")
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
	logAndRespond(w, err, "password-changed", body.To, body.Login)
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
	logAndRespond(w, err, "email-change", body.To, body.Login)
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

func logAndRespond(w http.ResponseWriter, err error, emailType, to, login string) {
	if err != nil {
		slog.Error("send error", "err", err)
		insertEmailLog(emailType, to, login, "failed", err.Error(), "")
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	insertEmailLog(emailType, to, login, "sent", "", "")
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return false
	}
	return true
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
