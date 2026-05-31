package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ScheduledEmail struct {
	ID           bson.ObjectID     `bson:"_id,omitempty"      json:"id"`
	TemplateName string            `bson:"templateName"        json:"templateName"`
	TemplateVars map[string]string `bson:"templateVars"        json:"templateVars"`
	To           string            `bson:"to"                  json:"to"`
	ScheduledFor time.Time         `bson:"scheduledFor"        json:"scheduledFor"`
	Status       string            `bson:"status"              json:"status"` // pending|sent|failed|cancelled
	CreatedAt    time.Time         `bson:"createdAt"           json:"createdAt"`
	SentAt       *time.Time        `bson:"sentAt,omitempty"    json:"sentAt,omitempty"`
	ErrorMsg     string            `bson:"errorMsg,omitempty"  json:"errorMsg,omitempty"`
}

type PaginatedScheduled struct {
	Data  []ScheduledEmail `json:"data"`
	Total int64            `json:"total"`
	Page  int              `json:"page"`
	Limit int              `json:"limit"`
	Pages int              `json:"pages"`
}

// ── Renderizador de templates ─────────────────────────────────────────────────

func renderTemplate(name string, vars map[string]string) (subject, html string, err error) {
	get := func(key, def string) string {
		if v, ok := vars[key]; ok && v != "" {
			return v
		}
		return def
	}
	switch name {
	case "welcome":
		login := get("login", "usuário")
		subject = "Bem-vindo à Santos Games Arena, " + login + "!"
		html = tmplWelcome(login)
	case "login-notification":
		login := get("login", "usuário")
		subject = "Novo acesso detectado — Santos Games Arena"
		html = tmplLoginNotification(login, get("ip", ""), get("userAgent", ""))
	case "password-reset":
		resetURL := get("resetUrl", "https://santos-games.com/reset")
		subject = "Redefinição de senha — Santos Games Arena"
		html = tmplPasswordReset(resetURL)
	case "password-changed":
		login := get("login", "usuário")
		subject = "Senha alterada — Santos Games Arena"
		html = tmplPasswordChanged(login)
	case "email-change":
		login := get("login", "usuário")
		confirmURL := get("confirmUrl", "https://santos-games.com/confirm")
		subject = "Confirme seu novo e-mail — Santos Games Arena"
		html = tmplEmailChangeConfirmation(login, confirmURL)
	default:
		err = fmt.Errorf("template %q não encontrado", name)
	}
	return
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
//
// Estratégia:
//  1. No boot, processa qualquer email já vencido.
//  2. Busca o próximo email pendente e configura um timer exato para ele.
//  3. Change stream observa novas inserções — quando chega um item cujo
//     scheduledFor é mais cedo que o timer atual, reinicia o timer.
//  4. Assim o latency é < 1s para "enviar agora" e exato para futuros.

// wakeC é um canal usado para acordar o scheduler quando um novo agendamento
// for criado com scheduledFor anterior ao próximo timer configurado.
var wakeC = make(chan time.Time, 1)

func schedulerLoop(ctx context.Context) {
	slog.Info("scheduler iniciado (timer-driven + change stream)")
	go watchInserts(ctx) // goroutine separada para change stream

	processDue(ctx)

	timer := nextTimer(ctx)
	for {
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			processDue(ctx)
			timer = nextTimer(ctx)
		case t := <-wakeC:
			// Novo agendamento mais cedo que o timer atual
			d := time.Until(t)
			if d < 0 {
				d = 0
			}
			timer.Reset(d)
		}
	}
}

// nextTimer retorna um timer que dispara na hora do próximo email pendente.
// Usa 1 hora como fallback (safety net).
func nextTimer(ctx context.Context) *time.Timer {
	ctx2, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var result struct {
		ScheduledFor time.Time `bson:"scheduledFor"`
	}
	opts := options.FindOne().SetSort(bson.D{{Key: "scheduledFor", Value: 1}})
	err := scheduledColl.FindOne(ctx2, bson.M{"status": "pending"}, opts).Decode(&result)
	if err != nil {
		return time.NewTimer(time.Hour) // nada pendente, verifica em 1h
	}
	d := time.Until(result.ScheduledFor)
	if d < 0 {
		d = 0
	}
	return time.NewTimer(d)
}

// watchInserts usa change stream para detectar novos documentos inseridos
// e acorda o scheduler se o novo item for mais urgente que o timer atual.
func watchInserts(ctx context.Context) {
	pipeline := bson.A{bson.M{"$match": bson.M{"operationType": "insert"}}}
	for {
		if ctx.Err() != nil {
			return
		}
		stream, err := scheduledColl.Watch(ctx, pipeline)
		if err != nil {
			slog.Error("change stream open", "err", err)
			time.Sleep(5 * time.Second)
			continue
		}
		for stream.Next(ctx) {
			var event struct {
				FullDocument ScheduledEmail `bson:"fullDocument"`
			}
			if err := stream.Decode(&event); err != nil {
				continue
			}
			doc := event.FullDocument
			if doc.Status != "pending" {
				continue
			}
			select {
			case wakeC <- doc.ScheduledFor:
			default:
				// canal já tem um item; não bloqueia
			}
		}
		stream.Close(ctx)
	}
}

func processDue(parentCtx context.Context) {
	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Second)
	defer cancel()

	filter := bson.M{
		"status":       "pending",
		"scheduledFor": bson.M{"$lte": time.Now().UTC()},
	}
	cur, err := scheduledColl.Find(ctx, filter)
	if err != nil {
		slog.Error("scheduler find", "err", err)
		return
	}
	defer cur.Close(ctx)

	var docs []ScheduledEmail
	if err := cur.All(ctx, &docs); err != nil {
		return
	}
	for _, doc := range docs {
		go sendScheduledEmail(doc)
	}
}

func sendScheduledEmail(doc ScheduledEmail) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	subj, html, err := renderTemplate(doc.TemplateName, doc.TemplateVars)
	if err != nil {
		updateScheduledStatus(ctx, doc.ID, "failed", err.Error())
		return
	}
	if sendErr := send(doc.To, subj, html); sendErr != nil {
		slog.Error("scheduled send failed", "id", doc.ID.Hex(), "err", sendErr)
		updateScheduledStatus(ctx, doc.ID, "failed", sendErr.Error())
		insertEmailLog(doc.TemplateName, doc.To, "", "failed", sendErr.Error(), "")
		return
	}
	slog.Info("scheduled email sent", "id", doc.ID.Hex(), "to", doc.To, "template", doc.TemplateName)
	updateScheduledStatus(ctx, doc.ID, "sent", "")
	insertEmailLog(doc.TemplateName, doc.To, "", "sent", "", "")
}

func updateScheduledStatus(ctx context.Context, id bson.ObjectID, status, errMsg string) {
	now := time.Now().UTC()
	update := bson.M{"$set": bson.M{
		"status":   status,
		"errorMsg": errMsg,
		"sentAt":   &now,
	}}
	if _, err := scheduledColl.UpdateByID(ctx, id, update); err != nil {
		slog.Error("update scheduled status", "err", err)
	}
}

// ── Handlers HTTP ─────────────────────────────────────────────────────────────

func adminScheduledListHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	page := queryInt(r, "page", 1)
	limit := queryInt(r, "limit", 20)
	status := r.URL.Query().Get("status")

	filter := bson.M{}
	if status != "" && status != "all" {
		filter["status"] = status
	}

	total, _ := scheduledColl.CountDocuments(ctx, filter)
	opts := options.Find().
		SetSort(bson.D{{Key: "scheduledFor", Value: -1}}).
		SetSkip(int64((page-1)*limit)).
		SetLimit(int64(limit))

	cur, err := scheduledColl.Find(ctx, filter, opts)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}
	defer cur.Close(ctx)

	var docs []ScheduledEmail
	if err := cur.All(ctx, &docs); err != nil {
		writeJSON(w, 500, map[string]string{"error": "decode_error"})
		return
	}
	if docs == nil {
		docs = []ScheduledEmail{}
	}
	pages := int(math.Ceil(float64(total) / float64(limit)))
	writeJSON(w, 200, PaginatedScheduled{Data: docs, Total: total, Page: page, Limit: limit, Pages: pages})
}

func adminScheduledCreateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TemplateName string            `json:"templateName"`
		TemplateVars map[string]string `json:"templateVars"`
		To           string            `json:"to"`
		ScheduledFor string            `json:"scheduledFor"` // ISO8601
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_body"})
		return
	}
	if body.TemplateName == "" || body.To == "" {
		writeJSON(w, 400, map[string]string{"error": "templateName and to are required"})
		return
	}
	// Validar que o template existe
	if _, _, err := renderTemplate(body.TemplateName, body.TemplateVars); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}

	var scheduledFor time.Time
	if body.ScheduledFor != "" {
		t, err := time.Parse(time.RFC3339, body.ScheduledFor)
		if err != nil {
			// Tenta sem timezone (datetime-local)
			t, err = time.Parse("2006-01-02T15:04", body.ScheduledFor)
			if err != nil {
				writeJSON(w, 400, map[string]string{"error": "invalid scheduledFor format"})
				return
			}
		}
		scheduledFor = t.UTC()
	} else {
		scheduledFor = time.Now().UTC()
	}

	doc := ScheduledEmail{
		ID:           bson.NewObjectID(),
		TemplateName: body.TemplateName,
		TemplateVars: body.TemplateVars,
		To:           body.To,
		ScheduledFor: scheduledFor,
		Status:       "pending",
		CreatedAt:    time.Now().UTC(),
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if _, err := scheduledColl.InsertOne(ctx, doc); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db_error"})
		return
	}

	// Se for para agora (ou passado), processa imediatamente em background
	if !scheduledFor.After(time.Now().UTC().Add(5 * time.Second)) {
		go sendScheduledEmail(doc)
	}

	writeJSON(w, 201, doc)
}

func adminScheduledCancelHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid_id"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	res, err := scheduledColl.UpdateByID(ctx, id, bson.M{"$set": bson.M{"status": "cancelled"}})
	if err != nil || res.MatchedCount == 0 {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
