import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar, Plus, Loader, CheckCircle, XCircle, Clock, AlertCircle,
  Trash2, Send, Search, ChevronLeft, ChevronRight, User,
} from "lucide-react";
import {
  fetchScheduled, createScheduled, cancelScheduled,
  fetchTemplates, fetchPlatformUsers,
  type ScheduledEmail, type TemplateMeta, type PlatformUser,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TEMPLATE_LABEL: Record<string, string> = {
  "welcome":            "Boas-vindas",
  "password-reset":     "Reset de senha",
  "login-notification": "Notif. de acesso",
  "password-changed":   "Senha alterada",
  "email-change":       "Troca de e-mail",
};

const LIMIT = 20;
const USER_PAGE_LIMIT = 6;

// ── Status badges ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ScheduledEmail["status"] }) {
  if (status === "sent")      return <Badge variant="success">Enviado</Badge>;
  if (status === "failed")    return <Badge variant="danger">Falhou</Badge>;
  if (status === "cancelled") return <Badge variant="muted">Cancelado</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}

function StatusIcon({ status }: { status: ScheduledEmail["status"] }) {
  if (status === "sent")      return <CheckCircle size={15} className="text-[#4ade80]" />;
  if (status === "failed")    return <AlertCircle size={15} className="text-[#f87171]" />;
  if (status === "cancelled") return <XCircle     size={15} className="text-white/20" />;
  return <Clock size={15} className="text-[#facc15]" />;
}

// ── User picker ──────────────────────────────────────────────────────────────

function UserPicker({
  onSelect,
  onClose,
}: {
  onSelect: (u: PlatformUser) => void;
  onClose:  () => void;
}) {
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users-picker", page, search],
    queryFn:  () => fetchPlatformUsers({ page, limit: USER_PAGE_LIMIT, search }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="absolute z-10 top-full left-0 mt-1 w-full bg-[#0e0f14] border border-white/[0.1] rounded-sm shadow-2xl">
      {/* Busca */}
      <div className="p-2 border-b border-white/[0.06]">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            autoFocus
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar login ou e-mail..."
            className="w-full bg-white/5 border border-white/[0.06] rounded-sm pl-7 pr-3 py-1.5 text-xs text-white/70 outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader size={16} className="text-[#f86d83] animate-spin" />
        </div>
      )}
      {!isLoading && data?.data.length === 0 && (
        <p className="px-4 py-4 text-xs text-white/20 text-center">Nenhum usuário encontrado.</p>
      )}
      {!isLoading && data?.data.map((u) => (
        <button
          key={u.login}
          onClick={() => { onSelect(u); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04]"
        >
          <div className="w-7 h-7 rounded-sm bg-white/5 flex items-center justify-center text-white/35 text-xs font-bold uppercase shrink-0">
            {u.login[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/75 truncate">{u.login}</p>
            <p className="text-[10px] text-white/35 font-mono truncate">{u.email}</p>
          </div>
        </button>
      ))}

      {/* Paginação compacta */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.05]">
          <span className="text-[10px] text-white/25">{data.total} usuários</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/60 disabled:opacity-20"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-[10px] text-white/30">{page}/{data.pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages}
              className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/60 disabled:opacity-20"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de novo agendamento ────────────────────────────────────────────────

function NewScheduleModal({
  templates,
  onClose,
  onSuccess,
}: {
  templates:  TemplateMeta[];
  onClose:    () => void;
  onSuccess:  () => void;
}) {
  const [step, setStep]                   = useState<"template" | "vars">("template");
  const [selectedTemplate, setTemplate]   = useState<TemplateMeta | null>(null);
  const [vars, setVars]                   = useState<Record<string, string>>({});
  const [to, setTo]                       = useState("");
  const [scheduledFor, setScheduledFor]   = useState("");
  const [sendNow, setSendNow]             = useState(false);
  const [showPicker, setShowPicker]       = useState(false);
  const [err, setErr]                     = useState("");

  // Apenas templates agendáveis
  const schedulable = templates.filter((t) => t.schedulable);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplate) throw new Error("no template");
      const sf = sendNow ? new Date().toISOString() : new Date(scheduledFor).toISOString();
      return createScheduled({
        templateName: selectedTemplate.name,
        templateVars: vars,
        to,
        scheduledFor: sf,
      });
    },
    onSuccess: () => { onSuccess(); onClose(); },
    onError:   (e: Error) => setErr(e.message),
  });

  function handleSelectTemplate(t: TemplateMeta) {
    const defaults: Record<string, string> = {};
    t.vars.forEach((v) => { defaults[v.key] = v.default; });
    setTemplate(t);
    setVars(defaults);
    setStep("vars");
  }

  const minDatetime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0e0f14] border border-white/[0.08] rounded-sm w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-[#f86d83]" />
            <span className="text-sm font-bold text-white">Novo agendamento</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
        </div>

        <div className="p-6">
          {/* Step 1: Selecionar template */}
          {step === "template" && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Escolha o template</p>
              <div className="space-y-1">
                {schedulable.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-sm text-left transition-colors group"
                  >
                    <div>
                      <p className="text-sm text-white/80 font-semibold">{t.label}</p>
                      {!t.isSystem && <p className="text-[10px] text-[#f86d83]/60 mt-0.5">Personalizado</p>}
                    </div>
                    <span className="text-[11px] text-white/20 font-mono group-hover:text-white/40">{t.name}</span>
                  </button>
                ))}
                {schedulable.length === 0 && (
                  <p className="text-sm text-white/30 text-center py-6">Nenhum template agendável disponível.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Variáveis + destinatário + horário */}
          {step === "vars" && selectedTemplate && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("template")}
                className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1"
              >
                ← {selectedTemplate.label}
              </button>

              {/* Variáveis do template */}
              {selectedTemplate.vars.map((v) => (
                <div key={v.key}>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    {v.label}
                  </label>
                  <Input
                    value={vars[v.key] ?? v.default}
                    onChange={(e) => setVars((p) => ({ ...p, [v.key]: e.target.value }))}
                    placeholder={v.default}
                  />
                </div>
              ))}

              {/* Destinatário com user picker */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Destinatário
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="destinatario@exemplo.com"
                      className="flex-1"
                    />
                    <button
                      onClick={() => setShowPicker((p) => !p)}
                      title="Selecionar usuário"
                      className={`px-3 border rounded-sm text-xs font-semibold transition-colors flex items-center gap-1 ${
                        showPicker
                          ? "bg-[#f86d83]/10 border-[#f86d83]/30 text-[#f86d83]"
                          : "bg-white/[0.04] border-white/[0.07] text-white/40 hover:text-white/70"
                      }`}
                    >
                      <User size={12} />
                    </button>
                  </div>
                  {showPicker && (
                    <UserPicker
                      onSelect={(u) => {
                        setTo(u.email);
                        if (selectedTemplate.vars.find((v) => v.key === "login")) {
                          setVars((p) => ({ ...p, login: u.login }));
                        }
                      }}
                      onClose={() => setShowPicker(false)}
                    />
                  )}
                </div>
              </div>

              {/* Quando enviar */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Quando enviar
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} className="accent-[#f86d83]" />
                    <span className="text-sm text-white/70">Enviar agora</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} className="accent-[#f86d83]" />
                    <span className="text-sm text-white/70">Agendar para</span>
                  </label>
                  {!sendNow && (
                    <Input
                      type="datetime-local"
                      value={scheduledFor}
                      min={minDatetime}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="mt-1"
                    />
                  )}
                </div>
              </div>

              {err && (
                <p className="text-xs text-[#f87171] flex items-center gap-1.5">
                  <AlertCircle size={12} /> {err}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-xs font-semibold text-white/40 border border-white/[0.07] rounded-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!to || (!sendNow && !scheduledFor) || mutation.isPending}
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold bg-[#f86d83] text-white rounded-sm hover:bg-[#e85c70] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {mutation.isPending
                    ? <Loader size={13} className="animate-spin" />
                    : sendNow ? <Send size={13} /> : <Calendar size={13} />}
                  {sendNow ? "Enviar agora" : "Agendar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export function SchedulePage() {
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("all");
  const [showModal, setModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled", page, status],
    queryFn:  () => fetchScheduled({ page, limit: LIMIT, status }),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn:  fetchTemplates,
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelScheduled,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["scheduled"] }),
  });

  const pending = data?.data.filter((s) => s.status === "pending").length ?? 0;
  const sent    = data?.data.filter((s) => s.status === "sent").length ?? 0;
  const failed  = data?.data.filter((s) => s.status === "failed").length ?? 0;

  return (
    <div className="p-8">
      {showModal && (
        <NewScheduleModal
          templates={templates}
          onClose={() => setModal(false)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["scheduled"] }); setPage(1); }}
        />
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Agendamentos</h1>
          <p className="text-sm text-white/35 mt-1">
            {data ? `${data.total} agendamentos` : "Carregando…"}
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#f86d83] text-white text-xs font-bold rounded-sm hover:bg-[#e85c70] transition-colors"
        >
          <Plus size={13} /> Novo agendamento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Pendentes", value: pending, color: "#facc15" },
          { label: "Enviados",  value: sent,    color: "#4ade80" },
          { label: "Falhas",    value: failed,  color: "#f87171" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0e0f14] border border-white/[0.07] rounded-sm px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs text-white/35 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="mb-5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-48">
          <option value="all">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="sent">Enviados</option>
          <option value="failed">Falhas</option>
          <option value="cancelled">Cancelados</option>
        </Select>
      </div>

      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader size={20} className="text-[#f86d83] animate-spin" />
          </div>
        )}
        {!isLoading && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["", "Destinatário", "Template", "Agendado para", "Status", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data?.data.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3.5 w-8"><StatusIcon status={s.status} /></td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white/70 font-mono">{s.to}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white/50">{TEMPLATE_LABEL[s.templateName] ?? s.templateName}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-white/60 font-mono">
                      {format(new Date(s.scheduledFor), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-[11px] text-white/25 mt-0.5">
                      {formatDistanceToNow(new Date(s.scheduledFor), { locale: ptBR, addSuffix: true })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={s.status} />
                    {s.errorMsg && (
                      <p className="text-[10px] text-[#f87171] mt-1 font-mono">{s.errorMsg}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.status === "pending" && (
                      <button
                        onClick={() => cancelMutation.mutate(s.id)}
                        disabled={cancelMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-[#f87171] transition-all"
                        title="Cancelar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && data?.data.length === 0 && (
          <div className="text-center py-16 text-white/20">
            <Calendar size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum agendamento encontrado</p>
          </div>
        )}
      </div>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onChange={setPage} />
      )}
    </div>
  );
}
