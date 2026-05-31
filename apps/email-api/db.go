package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	dbName         = "logs"
	collectionName = "sga_email_logs"
)

var (
	emailLogs      *mongo.Collection
	scheduledColl  *mongo.Collection
)

func initDB(ctx context.Context) {
	uri := mustEnv("MONGO_URL")
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		slog.Error("mongo connect failed", "err", err)
		os.Exit(1)
	}
	if err := client.Ping(ctx, nil); err != nil {
		slog.Error("mongo ping failed", "err", err)
		os.Exit(1)
	}
	db := client.Database(dbName)
	emailLogs = db.Collection(collectionName)
	scheduledColl = db.Collection("sga_email_scheduled")
	slog.Info("mongo connected", "db", dbName)
}

// EmailLogDoc segue o padrão de logs HTTP da infraestrutura.
type EmailLogDoc struct {
	ID          bson.ObjectID `bson:"_id,omitempty"  json:"id"`
	Type        string        `bson:"type"           json:"type"`
	OccurredAt  time.Time     `bson:"occurredAt"     json:"sentAt"`
	EmailType   string        `bson:"emailType"      json:"emailType"`
	To          string        `bson:"to"             json:"to"`
	Login       string        `bson:"login"          json:"login"`
	Status      string        `bson:"status"         json:"status"`
	ErrorMsg    string        `bson:"errorMsg,omitempty" json:"errorMsg,omitempty"`
	ResendID    string        `bson:"resendId,omitempty" json:"resendId,omitempty"`
}

func insertEmailLog(emailType, to, login, status, errorMsg, resendID string) {
	doc := EmailLogDoc{
		ID:         bson.NewObjectID(),
		Type:       "email",
		OccurredAt: time.Now().UTC(),
		EmailType:  emailType,
		To:         to,
		Login:      login,
		Status:     status,
		ErrorMsg:   errorMsg,
		ResendID:   resendID,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := emailLogs.InsertOne(ctx, doc); err != nil {
		slog.Error("failed to insert email log", "err", err)
	}
}

// Tipos usados nos handlers de admin

type PaginatedLogs struct {
	Data  []EmailLogDoc `json:"data"`
	Total int64         `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
	Pages int           `json:"pages"`
}

type UserSummary struct {
	Login         string    `bson:"_id"            json:"login"`
	Email         string    `bson:"email"          json:"email"`
	EmailCount    int       `bson:"emailCount"     json:"emailCount"`
	LastEmailAt   time.Time `bson:"lastEmailAt"    json:"lastEmailAt"`
	LastEmailType string    `bson:"lastEmailType"  json:"lastEmailType"`
}

type PaginatedUsers struct {
	Data  []UserSummary `json:"data"`
	Total int64         `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
	Pages int           `json:"pages"`
}

type StatsDoc struct {
	Sent    int64 `json:"sent"`
	Failed  int64 `json:"failed"`
	Pending int64 `json:"pending"`
	Total   int64 `json:"total"`
}

func ceilDiv(a, b int) int {
	if b == 0 {
		return 0
	}
	return (a + b - 1) / b
}
