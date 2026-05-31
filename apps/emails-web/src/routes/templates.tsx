import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Eye, Send, Loader, CheckCircle, AlertCircle,
  Trash2, Save, Lock, X, PlusCircle,
} from "lucide-react";
import {
  fetchTemplates, fetchTemplatePreviewUrl, testTemplate,
  createTemplate, updateTemplate, deleteTemplate,
  type TemplateMeta, type TemplateVar,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Sidebar de lista ─────────────────────────────────────────────────────────

function TemplateListItem({
  t, selected, onSelect,
}: { t: TemplateMeta; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors border-b border-white/[0.04] ${
        selected ? "bg-[#f86d83]/10" : "hover:bg-white/[0.03]"
      }`}
    >
      <FileText size={13} className={`mt-0.5 shrink-0 ${selected ? "text-[#f86d83]" : "text-white/25"}`} />
      <div className="min-w-0">
        <p className={`text-sm font-semibold truncate ${selected ? "text-[#f86d83]" : "text-white/70"}`}>
          {t.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-white/25 font-mono">{t.name}</span>
          {t.isSystem && <Lock size={9} className="text-white/20" />}
        </div>
      </div>
    </button>
  );
}

// ── Painel de preview (templates de sistema) ─────────────────────────────────

function SystemPreview({ t }: { t: TemplateMeta }) {
  const [vars, setVars]       = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    t.vars.forEach((v) => { d[v.key] = v.default; });
    return d;
  });
  const [previewKey, setKey]  = useState(0);
  const [to, setTo]           = useState("");
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState("");

  const mutation = useMutation({
    mutationFn: () => testTemplate(t.name, { to, ...vars }),
    onSuccess: () => { setSent(true); setErr(""); setTimeout(() => setSent(false), 3000); },
    onError:   (e: Error) => setErr(e.message),
  });

  const url = fetchTemplatePreviewUrl(t.name, vars);

  return (
    <div className="flex gap-5 flex-1 min-h-0">
      {/* Variáveis + test send */}
      <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
        <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={12} className="text-white/25" />
            <p className="text-xs font-bold text-white/50">Template de sistema · somente leitura</p>
          </div>
          {t.vars.map((v) => (
            <div key={v.key} className="mb-3">
              <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">
                {v.label}
              </label>
              <Input
                value={vars[v.key] ?? v.default}
                onChange={(e) => setVars((p) => ({ ...p, [v.key]: e.target.value }))}
                placeholder={v.default}
              />
            </div>
          ))}
          <button
            onClick={() => setKey((k) => k + 1)}
            className="w-full mt-1 py-1.5 text-xs font-bold text-[#f86d83] border border-[#f86d83]/20 rounded-sm hover:bg-[#f86d83]/5 transition-colors"
          >
            Atualizar preview
          </button>
        </div>

        <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-4">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
            Enviar teste
          </p>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="destinatário@exemplo.com"
            className="mb-2"
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={!to || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold bg-[#f86d83] text-white rounded-sm hover:bg-[#e85c70] disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
            Enviar
          </button>
          {sent && <p className="text-[11px] text-[#4ade80] mt-2 flex items-center gap-1"><CheckCircle size={11} /> Enviado!</p>}
          {err  && <p className="text-[11px] text-[#f87171] mt-2 flex items-center gap-1"><AlertCircle size={11} /> {err}</p>}
        </div>
      </div>

      {/* iframe preview */}
      <div className="flex-1 bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
          <Eye size={12} className="text-white/25" />
          <span className="text-[11px] text-white/30 font-mono">{t.name}</span>
        </div>
        <div className="flex-1">
          <iframe key={previewKey} src={url} className="w-full h-full border-0" title="Preview" sandbox="allow-same-origin" />
        </div>
      </div>
    </div>
  );
}

// ── Editor de template customizado ───────────────────────────────────────────

const STARTER_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:40px 16px;background:#06070a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0e0f14;border:1px solid rgba(255,255,255,0.07);border-radius:2px;padding:32px;">
      <h1 style="color:#fff;margin:0 0 16px;font-size:22px;">{titulo}</h1>
      <p style="color:rgba(255,255,255,0.55);margin:0 0 24px;line-height:1.7;">Olá, {login}!</p>
      <a href="{url}" style="display:inline-block;background:#f86d83;color:#fff;text-decoration:none;padding:14px 32px;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:2px;">
        ACESSAR
      </a>
    </td></tr>
    <tr><td style="padding-top:20px;text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">© 2026 Santos Games Arena</p>
    </td></tr>
  </table>
</body>
</html>`;

function CustomEditor({
  template,
  onSaved,
  onDeleted,
}: {
  template: TemplateMeta | null; // null = criando novo
  onSaved:   (t: TemplateMeta) => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !template;

  const [name,    setName]    = useState(template?.name    ?? "");
  const [label,   setLabel]   = useState(template?.label   ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body,    setBody]    = useState(template?.body    ?? STARTER_HTML);
  const [vars,    setVars]    = useState<TemplateVar[]>(template?.vars ?? []);
  const [tab,     setTab]     = useState<"editor" | "preview">("editor");
  const [err,     setErr]     = useState("");
  const [to,      setTo]      = useState("");
  const [sent,    setSent]    = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview client-side: substitui {var} pelos defaults
  const previewHtml = vars.reduce(
    (h, v) => h.replaceAll(`{${v.key}}`, v.default || `[${v.key}]`),
    body
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? createTemplate({ name, label, subject, body, vars })
        : updateTemplate(template!.name, { label, subject, body, vars }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setErr("");
      onSaved(isNew ? (data as TemplateMeta) : { ...template!, label, subject, body, vars });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTemplate(template!.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      onDeleted();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => {
      const v: Record<string, string> = {};
      vars.forEach((vr) => { v[vr.key] = vr.default; });
      return testTemplate(isNew ? name : template!.name, { to, ...v });
    },
    onSuccess: () => { setSent(true); setTimeout(() => setSent(false), 3000); },
    onError:   (e: Error) => setErr(e.message),
  });

  function insertVar(key: string) {
    const ta = textareaRef.current;
    if (!ta) { setBody((b) => b + `{${key}}`); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = body.slice(0, start) + `{${key}}` + body.slice(end);
    setBody(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + key.length + 2, start + key.length + 2); }, 0);
  }

  function addVar() {
    setVars((v) => [...v, { key: "", label: "", default: "" }]);
  }

  function removeVar(i: number) {
    setVars((v) => v.filter((_, idx) => idx !== i));
  }

  function updateVar(i: number, field: keyof TemplateVar, val: string) {
    setVars((v) => v.map((vr, idx) => idx === i ? { ...vr, [field]: val } : vr));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Barra de campos */}
      <div className="grid grid-cols-3 gap-3">
        {isNew && (
          <div>
            <label className="block text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1">Nome (slug)</label>
            <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="meu-template" />
          </div>
        )}
        <div className={isNew ? "" : "col-span-1"}>
          <label className="block text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1">Título</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome de exibição" />
        </div>
        <div className={isNew ? "" : "col-span-2"}>
          <label className="block text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1">Assunto do e-mail</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto — Santos Games Arena" />
        </div>
      </div>

      {/* Variáveis */}
      <div className="bg-[#0c0d11] border border-white/[0.05] rounded-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Variáveis</p>
          <button onClick={addVar} className="flex items-center gap-1 text-[11px] text-[#f86d83] hover:text-[#e85c70]">
            <PlusCircle size={12} /> Adicionar
          </button>
        </div>
        {vars.length === 0 && (
          <p className="text-[11px] text-white/20">Nenhuma variável. Use <code className="text-white/40">&#123;chave&#125;</code> no HTML e adicione a definição aqui.</p>
        )}
        <div className="space-y-2">
          {vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={v.key}
                onChange={(e) => updateVar(i, "key", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="chave"
                className="w-28 font-mono text-xs"
              />
              <Input
                value={v.label}
                onChange={(e) => updateVar(i, "label", e.target.value)}
                placeholder="Label"
                className="flex-1 text-xs"
              />
              <Input
                value={v.default}
                onChange={(e) => updateVar(i, "default", e.target.value)}
                placeholder="Valor padrão"
                className="flex-1 text-xs"
              />
              <button
                onClick={() => v.key && insertVar(v.key)}
                title="Inserir no HTML"
                className="text-[10px] px-2 py-1 bg-white/5 text-white/40 hover:text-white/70 rounded-sm font-mono shrink-0"
              >
                &#123;&#125;
              </button>
              <button onClick={() => removeVar(i)} className="text-white/20 hover:text-[#f87171]">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs editor / preview */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {(["editor", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-sm transition-colors ${
              tab === t ? "bg-white/[0.06] text-white" : "text-white/30 hover:text-white/60"
            }`}
          >
            {t === "editor" ? "HTML" : "Preview"}
          </button>
        ))}
      </div>

      {/* Editor */}
      {tab === "editor" && (
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 bg-[#0c0d11] border border-white/[0.06] rounded-sm p-4 text-xs text-white/70 font-mono resize-none outline-none focus:border-white/20 transition-colors"
          spellCheck={false}
        />
      )}

      {/* Preview */}
      {tab === "preview" && (
        <div className="flex-1 border border-white/[0.06] rounded-sm overflow-hidden">
          <iframe
            key={previewHtml}
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            title="Preview"
            sandbox=""
          />
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Teste: destinatário@exemplo.com"
            className="w-56"
          />
          <button
            onClick={() => testMutation.mutate()}
            disabled={!to || testMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-white/[0.07] text-white/50 hover:text-white/80 rounded-sm disabled:opacity-30 transition-colors"
          >
            {testMutation.isPending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
            Enviar teste
          </button>
          {sent && <span className="text-[11px] text-[#4ade80] flex items-center gap-1"><CheckCircle size={11} /> Enviado!</span>}
        </div>

        {!isNew && (
          <button
            onClick={() => { if (confirm(`Deletar "${template!.label}"?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#f87171]/60 hover:text-[#f87171] hover:bg-[#f87171]/5 rounded-sm transition-colors"
          >
            <Trash2 size={12} /> Deletar
          </button>
        )}

        {err && <span className="text-[11px] text-[#f87171] flex items-center gap-1"><AlertCircle size={11} /> {err}</span>}

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !label || !subject || !body || (isNew && !name)}
          className="flex items-center gap-2 px-4 py-2 bg-[#f86d83] text-white text-xs font-bold rounded-sm hover:bg-[#e85c70] disabled:opacity-40 transition-colors"
        >
          {saveMutation.isPending ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          {isNew ? "Criar template" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

type ViewState =
  | { mode: "system";   template: TemplateMeta }
  | { mode: "custom";   template: TemplateMeta }
  | { mode: "new" }
  | null;

export function TemplatesPage() {
  const [view, setView] = useState<ViewState>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn:  fetchTemplates,
    staleTime: 30_000,
  });

  const systemList = templates.filter((t) => t.isSystem);
  const customList = templates.filter((t) => !t.isSystem);

  const selectedName =
    view?.mode === "system" || view?.mode === "custom" ? view.template.name : null;

  function handleSaved(saved: TemplateMeta) {
    setView({ mode: "custom", template: saved });
  }

  return (
    <div className="p-8 flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Templates</h1>
          <p className="text-sm text-white/35 mt-1">{templates.length} templates</p>
        </div>
        <button
          onClick={() => setView({ mode: "new" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#f86d83] text-white text-xs font-bold rounded-sm hover:bg-[#e85c70] transition-colors"
        >
          <Plus size={13} /> Novo template
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-52 shrink-0 bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-y-auto flex flex-col">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader size={16} className="text-[#f86d83] animate-spin" />
            </div>
          )}

          {!isLoading && systemList.length > 0 && (
            <>
              <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-1.5">
                <Lock size={10} className="text-white/20" />
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Sistema</p>
              </div>
              {systemList.map((t) => (
                <TemplateListItem
                  key={t.name}
                  t={t}
                  selected={selectedName === t.name}
                  onSelect={() => setView({ mode: "system", template: t })}
                />
              ))}
            </>
          )}

          {!isLoading && (
            <>
              <div className="px-4 py-2.5 border-b border-white/[0.04] border-t border-t-white/[0.04] flex items-center gap-1.5 mt-1">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Personalizados</p>
              </div>
              {customList.length === 0 && (
                <p className="px-4 py-3 text-[11px] text-white/20">Nenhum template criado.</p>
              )}
              {customList.map((t) => (
                <TemplateListItem
                  key={t.name}
                  t={t}
                  selected={selectedName === t.name}
                  onSelect={() => setView({ mode: "custom", template: t })}
                />
              ))}
              {view?.mode === "new" && (
                <div className="px-4 py-3 border-b border-white/[0.04] bg-[#f86d83]/5 flex items-center gap-2">
                  <FileText size={12} className="text-[#f86d83]" />
                  <span className="text-xs text-[#f86d83] font-semibold">Novo template</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Painel direito */}
        <div className="flex-1 flex flex-col min-w-0">
          {!view && (
            <div className="flex-1 bg-[#0e0f14] border border-white/[0.07] rounded-sm flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center">
                <FileText size={22} className="text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white/40">Selecione um template</p>
                <p className="text-xs text-white/20 mt-1">Ou clique em "Novo template" para criar um.</p>
              </div>
            </div>
          )}

          {view?.mode === "system" && <SystemPreview t={view.template} />}

          {(view?.mode === "custom" || view?.mode === "new") && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#0e0f14] border border-white/[0.07] rounded-sm p-5">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/[0.06]">
                <FileText size={14} className="text-[#f86d83]" />
                <span className="text-sm font-bold text-white">
                  {view.mode === "new" ? "Novo template" : view.template.label}
                </span>
                {view.mode === "custom" && <Badge variant="muted" className="ml-auto">Personalizado</Badge>}
              </div>
              <CustomEditor
                template={view.mode === "custom" ? view.template : null}
                onSaved={handleSaved}
                onDeleted={() => setView(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
