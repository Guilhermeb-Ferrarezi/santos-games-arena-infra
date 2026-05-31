package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net/http"
	"regexp"
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

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$`)

var systemNames = map[string]bool{
	"welcome": true, "login-notification": true,
	"password-reset": true, "password-changed": true, "email-change": true,
}

// ── Stats ────────────────────────────────────────────────────────────────────

func adminStatsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	sent, _    := emailLogs.CountDocuments(ctx, bson.M{"status": "sent"})
	failed, _  := emailLogs.CountDocuments(ctx, bson.M{"status": "failed"})
	pending, _ := emailLogs.CountDocuments(ctx, bson.M{"status": "pending"})
	total, _   := emailLogs.CountDocuments(ctx, bson.M{})
	writeJSON(w, 200, StatsDoc{Sent: sent, Failed: failed, Pending: pending, Total: total})
}

// ── Logs ─────────────────────────────────────────────────────────────────────

func adminLogsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	page      := queryInt(r, "page", 1)
	limit     := queryInt(r, "limit", 20)
	search    := strings.TrimSpace(r.URL.Query().Get("search"))
	emailType := r.URL.Query().Get("type")
	status    := r.URL.Query().Get("status")

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"to":    bson.M{"$regex": search, "$options": "i"}},
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
	opts := options.Find().
		SetSort(bson.D{{Key: "occurredAt", Value: -1}}).
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit))

	cur, err := emailLogs.Find(ctx, filter, opts)
	if err != nil {
		slog.Error("logs find", "err", err)
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}
	defer cur.Close(ctx)

	var docs []EmailLogDoc
	cur.All(ctx, &docs)
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

	page   := queryInt(r, "page", 1)
	limit  := queryInt(r, "limit", 20)
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	matchStage := bson.M{}
	if search != "" {
		matchStage = bson.M{"$or": bson.A{
			bson.M{"login": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"to":    bson.M{"$regex": search, "$options": "i"}},
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

type TemplateVar struct {
	Key     string `bson:"key"     json:"key"`
	Label   string `bson:"label"   json:"label"`
	Default string `bson:"default" json:"default"`
}

type TemplateMeta struct {
	ID          string        `bson:"_id,omitempty"    json:"id,omitempty"`
	Name        string        `bson:"name"             json:"name"`
	Label       string        `bson:"label"            json:"label"`
	Subject     string        `bson:"subject,omitempty" json:"subject,omitempty"`
	Body        string        `bson:"body,omitempty"   json:"body,omitempty"`
	Vars        []TemplateVar `bson:"vars"             json:"vars"`
	IsSystem    bool          `bson:"-"                json:"isSystem"`
	Schedulable bool          `bson:"-"                json:"schedulable"`
	CreatedAt   *time.Time    `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt   *time.Time    `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

// Templates de sistema (hardcoded, não editáveis).
// Apenas "welcome" é agendável manualmente — os outros são disparados pelo sistema.
var systemTemplates = []TemplateMeta{
	{
		Name: "welcome", Label: "Boas-vindas", IsSystem: true, Schedulable: true,
		Vars: []TemplateVar{
			{Key: "login", Label: "Login", Default: "guilherme"},
		},
	},
	{
		Name: "login-notification", Label: "Notificação de acesso", IsSystem: true, Schedulable: false,
		Vars: []TemplateVar{
			{Key: "login", Label: "Login", Default: "guilherme"},
			{Key: "ip", Label: "IP", Default: "192.168.1.1"},
			{Key: "userAgent", Label: "User-Agent", Default: "Mozilla/5.0 Chrome/120"},
		},
	},
	{
		Name: "password-reset", Label: "Reset de senha", IsSystem: true, Schedulable: false,
		Vars: []TemplateVar{
			{Key: "resetUrl", Label: "URL de reset", Default: "https://santos-games.com/reset?token=exemplo"},
		},
	},
	{
		Name: "password-changed", Label: "Senha alterada", IsSystem: true, Schedulable: false,
		Vars: []TemplateVar{
			{Key: "login", Label: "Login", Default: "guilherme"},
		},
	},
	{
		Name: "email-change", Label: "Confirmação de e-mail", IsSystem: true, Schedulable: false,
		Vars: []TemplateVar{
			{Key: "login", Label: "Login", Default: "guilherme"},
			{Key: "confirmUrl", Label: "URL de confirmação", Default: "https://santos-games.com/confirm?token=exemplo"},
		},
	},
}

// adminTemplatesHandler: retorna templates de sistema + customizados do banco.
func adminTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	result := make([]TemplateMeta, len(systemTemplates))
	copy(result, systemTemplates)

	cur, err := templatesColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err == nil {
		var custom []TemplateMeta
		cur.All(ctx, &custom)
		cur.Close(ctx)
		for i := range custom {
			custom[i].IsSystem    = false
			custom[i].Schedulable = true
		}
		result = append(result, custom...)
	}
	writeJSON(w, 200, result)
}

// adminTemplateGetHandler: retorna detalhes de um template (custom) ou meta de sistema.
func adminTemplateGetHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	// Sistema
	for _, t := range systemTemplates {
		if t.Name == name {
			writeJSON(w, 200, t)
			return
		}
	}
	// Custom
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var t TemplateMeta
	if err := templatesColl.FindOne(ctx, bson.M{"name": name}).Decode(&t); err != nil {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	t.IsSystem    = false
	t.Schedulable = true
	writeJSON(w, 200, t)
}

// adminTemplatePreviewHandler: renderiza HTML do template com os vars da query string.
func adminTemplatePreviewHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	q    := r.URL.Query()

	// Sistema
	var html string
	switch name {
	case "welcome":
		login := q.Get("login"); if login == "" { login = "guilherme" }
		html = tmplWelcome(login)
	case "login-notification":
		login := q.Get("login"); if login == "" { login = "guilherme" }
		html = tmplLoginNotification(login, q.Get("ip"), q.Get("userAgent"))
	case "password-reset":
		u := q.Get("resetUrl"); if u == "" { u = "https://santos-games.com/reset?token=exemplo" }
		html = tmplPasswordReset(u)
	case "password-changed":
		login := q.Get("login"); if login == "" { login = "guilherme" }
		html = tmplPasswordChanged(login)
	case "email-change":
		login := q.Get("login"); if login == "" { login = "guilherme" }
		cu := q.Get("confirmUrl"); if cu == "" { cu = "https://santos-games.com/confirm?token=exemplo" }
		html = tmplEmailChangeConfirmation(login, cu)
	default:
		// Tentar custom
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		var t TemplateMeta
		if err := templatesColl.FindOne(ctx, bson.M{"name": name}).Decode(&t); err != nil {
			writeJSON(w, 404, map[string]string{"error": "template_not_found"})
			return
		}
		html = t.Body
		for _, v := range t.Vars {
			val := q.Get(v.Key); if val == "" { val = v.Default }
			html = strings.ReplaceAll(html, "{"+v.Key+"}", val)
		}
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(200)
	w.Write([]byte(html))
}

// adminTemplateTestHandler: envia e-mail de teste.
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
	subj, html, err := renderTemplate(name, body)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": err.Error()})
		return
	}
	if err := send(to, subj, html); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ── Templates CRUD (custom only) ─────────────────────────────────────────────

func adminTemplateCreateHandler(w http.ResponseWriter, r *http.Request) {
	var t TemplateMeta
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return
	}
	if !slugRe.MatchString(t.Name) {
		writeJSON(w, 400, map[string]string{"error": "invalid name: use lowercase letters, numbers, hyphens (3-50 chars)"})
		return
	}
	if systemNames[t.Name] {
		writeJSON(w, 409, map[string]string{"error": "name conflicts with system template"})
		return
	}
	if t.Label == "" || t.Subject == "" || t.Body == "" {
		writeJSON(w, 400, map[string]string{"error": "label, subject and body are required"})
		return
	}
	if t.Vars == nil {
		t.Vars = []TemplateVar{}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Checar duplicidade
	n, _ := templatesColl.CountDocuments(ctx, bson.M{"name": t.Name})
	if n > 0 {
		writeJSON(w, 409, map[string]string{"error": "name already exists"})
		return
	}

	now := time.Now().UTC()
	t.CreatedAt = &now
	t.UpdatedAt = &now
	t.ID        = bson.NewObjectID().Hex()
	t.IsSystem  = false
	t.Schedulable = true

	if _, err := templatesColl.InsertOne(ctx, t); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}
	writeJSON(w, 201, t)
}

func adminTemplateUpdateHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if systemNames[name] {
		writeJSON(w, 403, map[string]string{"error": "cannot edit system templates"})
		return
	}

	var patch struct {
		Label   string        `json:"label"`
		Subject string        `json:"subject"`
		Body    string        `json:"body"`
		Vars    []TemplateVar `json:"vars"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	now := time.Now().UTC()
	update := bson.M{"$set": bson.M{
		"label":     patch.Label,
		"subject":   patch.Subject,
		"body":      patch.Body,
		"vars":      patch.Vars,
		"updatedAt": now,
	}}
	res, err := templatesColl.UpdateOne(ctx, bson.M{"name": name}, update)
	if err != nil || res.MatchedCount == 0 {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func adminTemplateDeleteHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if systemNames[name] {
		writeJSON(w, 403, map[string]string{"error": "cannot delete system templates"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	res, err := templatesColl.DeleteOne(ctx, bson.M{"name": name})
	if err != nil || res.DeletedCount == 0 {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
