package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var authServiceURL string

// ── Auth middleware ──────────────────────────────────────────────────────────

func adminAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("sga_auth")
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "no_session"})
			return
		}
		req, _ := http.NewRequestWithContext(r.Context(), "GET", authServiceURL+"/api/auth/session", nil)
		req.AddCookie(&http.Cookie{Name: "sga_auth", Value: cookie.Value})

		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp.StatusCode != 200 {
			writeJSON(w, 401, map[string]string{"error": "invalid_session"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)

		var session struct {
			Authenticated bool `json:"authenticated"`
			User          struct {
				Role int `json:"role"`
			} `json:"user"`
		}
		if err := json.Unmarshal(body, &session); err != nil || !session.Authenticated || session.User.Role != 1 {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}
		next(w, r)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if n, err := strconv.Atoi(v); err == nil && n > 0 {
		return n
	}
	return def
}

// ── Stats ────────────────────────────────────────────────────────────────────

func adminStatsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	sent, _ := emailLogs.CountDocuments(ctx, bson.M{"status": "sent"})
	failed, _ := emailLogs.CountDocuments(ctx, bson.M{"status": "failed"})
	pending, _ := emailLogs.CountDocuments(ctx, bson.M{"status": "pending"})
	total, _ := emailLogs.CountDocuments(ctx, bson.M{})

	writeJSON(w, 200, StatsDoc{Sent: sent, Failed: failed, Pending: pending, Total: total})
}

// ── Logs ─────────────────────────────────────────────────────────────────────

func adminLogsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	page := queryInt(r, "page", 1)
	limit := queryInt(r, "limit", 20)
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	emailType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"to": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"login": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	if emailType != "" && emailType != "all" {
		filter["emailType"] = emailType
	}
	if status != "" && status != "all" {
		filter["status"] = status
	}

	total, _ := emailLogs.CountDocuments(ctx, filter)
	skip := int64((page - 1) * limit)
	opts := options.Find().
		SetSort(bson.D{{Key: "occurredAt", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cur, err := emailLogs.Find(ctx, filter, opts)
	if err != nil {
		slog.Error("logs find", "err", err)
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}
	defer cur.Close(ctx)

	var docs []EmailLogDoc
	if err := cur.All(ctx, &docs); err != nil {
		writeJSON(w, 500, map[string]string{"error": "decode_error"})
		return
	}
	if docs == nil {
		docs = []EmailLogDoc{}
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))
	writeJSON(w, 200, PaginatedLogs{Data: docs, Total: total, Page: page, Limit: limit, Pages: pages})
}

// ── Users ────────────────────────────────────────────────────────────────────

func adminUsersHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	page := queryInt(r, "page", 1)
	limit := queryInt(r, "limit", 20)
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	matchStage := bson.M{}
	if search != "" {
		matchStage = bson.M{"$or": bson.A{
			bson.M{"login": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"to": bson.M{"$regex": search, "$options": "i"}},
		}}
	}

	pipeline := bson.A{
		bson.M{"$match": matchStage},
		bson.M{"$sort": bson.M{"occurredAt": -1}},
		bson.M{"$group": bson.M{
			"_id":           "$login",
			"email":         bson.M{"$first": "$to"},
			"emailCount":    bson.M{"$sum": 1},
			"lastEmailAt":   bson.M{"$max": "$occurredAt"},
			"lastEmailType": bson.M{"$first": "$emailType"},
		}},
		bson.M{"$sort": bson.M{"lastEmailAt": -1}},
		bson.M{"$facet": bson.M{
			"data":  bson.A{bson.M{"$skip": (page - 1) * limit}, bson.M{"$limit": limit}},
			"total": bson.A{bson.M{"$count": "n"}},
		}},
	}

	cur, err := emailLogs.Aggregate(ctx, pipeline)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}
	defer cur.Close(ctx)

	var results []struct {
		Data  []UserSummary `bson:"data"`
		Total []struct {
			N int `bson:"n"`
		} `bson:"total"`
	}
	if err := cur.All(ctx, &results); err != nil || len(results) == 0 {
		writeJSON(w, 200, PaginatedUsers{Data: []UserSummary{}, Total: 0, Page: page, Limit: limit, Pages: 0})
		return
	}

	data := results[0].Data
	if data == nil {
		data = []UserSummary{}
	}
	var total int64
	if len(results[0].Total) > 0 {
		total = int64(results[0].Total[0].N)
	}
	pages := int(math.Ceil(float64(total) / float64(limit)))
	writeJSON(w, 200, PaginatedUsers{Data: data, Total: total, Page: page, Limit: limit, Pages: pages})
}

// ── Templates ────────────────────────────────────────────────────────────────

type TemplateMeta struct {
	Name  string              `json:"name"`
	Label string              `json:"label"`
	Vars  []map[string]string `json:"vars"`
}

var templateMeta = []TemplateMeta{
	{Name: "welcome", Label: "Boas-vindas", Vars: []map[string]string{
		{"key": "login", "label": "Login", "default": "guilherme"},
	}},
	{Name: "login-notification", Label: "Notificação de acesso", Vars: []map[string]string{
		{"key": "login", "label": "Login", "default": "guilherme"},
		{"key": "ip", "label": "IP", "default": "192.168.1.1"},
		{"key": "userAgent", "label": "User-Agent", "default": "Mozilla/5.0 Chrome/120"},
	}},
	{Name: "password-reset", Label: "Reset de senha", Vars: []map[string]string{
		{"key": "resetUrl", "label": "URL de reset", "default": "https://santos-games.com/reset?token=exemplo"},
	}},
	{Name: "password-changed", Label: "Senha alterada", Vars: []map[string]string{
		{"key": "login", "label": "Login", "default": "guilherme"},
	}},
	{Name: "email-change", Label: "Confirmação de e-mail", Vars: []map[string]string{
		{"key": "login", "label": "Login", "default": "guilherme"},
		{"key": "confirmUrl", "label": "URL de confirmação", "default": "https://santos-games.com/confirm?token=exemplo"},
	}},
}

func adminTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, templateMeta)
}

func adminTemplatePreviewHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	q := r.URL.Query()

	var html string
	switch name {
	case "welcome":
		login := q.Get("login")
		if login == "" {
			login = "guilherme"
		}
		html = tmplWelcome(login)
	case "login-notification":
		login := q.Get("login")
		ip := q.Get("ip")
		ua := q.Get("userAgent")
		if login == "" {
			login = "guilherme"
		}
		html = tmplLoginNotification(login, ip, ua)
	case "password-reset":
		url := q.Get("resetUrl")
		if url == "" {
			url = "https://santos-games.com/reset?token=exemplo"
		}
		html = tmplPasswordReset(url)
	case "password-changed":
		login := q.Get("login")
		if login == "" {
			login = "guilherme"
		}
		html = tmplPasswordChanged(login)
	case "email-change":
		login := q.Get("login")
		cu := q.Get("confirmUrl")
		if login == "" {
			login = "guilherme"
		}
		if cu == "" {
			cu = "https://santos-games.com/confirm?token=exemplo"
		}
		html = tmplEmailChangeConfirmation(login, cu)
	default:
		writeJSON(w, 404, map[string]string{"error": "template_not_found"})
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(200)
	w.Write([]byte(html))
}

func adminTemplateTestHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return
	}
	to := body["to"]
	if to == "" {
		writeJSON(w, 400, map[string]string{"error": "missing_to"})
		return
	}

	var (
		subject string
		html    string
	)
	switch name {
	case "welcome":
		login := body["login"]
		if login == "" {
			login = "teste"
		}
		subject = "Bem-vindo à Santos Games Arena, " + login + "!"
		html = tmplWelcome(login)
	case "login-notification":
		login := body["login"]
		if login == "" {
			login = "teste"
		}
		subject = "Novo acesso detectado — Santos Games Arena"
		html = tmplLoginNotification(login, body["ip"], body["userAgent"])
	case "password-reset":
		resetURL := body["resetUrl"]
		if resetURL == "" {
			resetURL = "https://santos-games.com/reset?token=teste"
		}
		subject = "Redefinição de senha — Santos Games Arena"
		html = tmplPasswordReset(resetURL)
	case "password-changed":
		login := body["login"]
		if login == "" {
			login = "teste"
		}
		subject = "Senha alterada — Santos Games Arena"
		html = tmplPasswordChanged(login)
	case "email-change":
		login := body["login"]
		if login == "" {
			login = "teste"
		}
		confirmURL := body["confirmUrl"]
		if confirmURL == "" {
			confirmURL = "https://santos-games.com/confirm?token=teste"
		}
		subject = "Confirme seu novo e-mail — Santos Games Arena"
		html = tmplEmailChangeConfirmation(login, confirmURL)
	default:
		writeJSON(w, 404, map[string]string{"error": "template_not_found"})
		return
	}

	if err := send(to, subject, html); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
