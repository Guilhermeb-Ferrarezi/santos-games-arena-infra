import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Eye, Send, Loader, CheckCircle, AlertCircle } from "lucide-react";
import { fetchTemplates, fetchTemplatePreviewUrl, testTemplate, type TemplateMeta } from "@/lib/api";
import { Input } from "@/components/ui/input";

function TemplateList({
  templates,
  selected,
  onSelect,
  loading,
}: {
  templates: TemplateMeta[];
  selected: TemplateMeta | null;
  onSelect: (t: TemplateMeta) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={18} className="text-[#f86d83] animate-spin" />
      </div>
    );
  }
  return (
    <div className="divide-y divide-white/[0.04]">
      {templates.map((t) => (
        <button
          key={t.name}
          onClick={() => onSelect(t)}
          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
            selected?.name === t.name
              ? "bg-[#f86d83]/10 text-[#f86d83]"
              : "text-white/60 hover:bg-white/[0.03] hover:text-white/80"
          }`}
        >
          <FileText size={14} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold">{t.label}</p>
            <p className="text-[11px] text-white/30 font-mono mt-0.5">{t.name}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function VarsForm({
  template,
  values,
  onChange,
}: {
  template: TemplateMeta;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {template.vars.map((v) => (
        <div key={v.key}>
          <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
            {v.label}
          </label>
          <Input
            value={values[v.key] ?? v.default}
            onChange={(e) => onChange(v.key, e.target.value)}
            placeholder={v.default}
          />
        </div>
      ))}
    </div>
  );
}

function TestSend({
  template,
  vars,
}: {
  template: TemplateMeta;
  vars: Record<string, string>;
}) {
  const [to, setTo] = useState("");
  const [sent, setSent]   = useState(false);
  const [err, setErr]     = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = { to, ...vars };
      return testTemplate(template.name, body);
    },
    onSuccess: () => {
      setSent(true);
      setErr("");
      setTimeout(() => setSent(false), 3000);
    },
    onError: (e: Error) => {
      setErr(e.message);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider">
        Enviar e-mail de teste
      </label>
      <div className="flex gap-2">
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="destinatário@exemplo.com"
          type="email"
          className="flex-1"
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={!to || mutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[#f86d83] text-white text-xs font-bold rounded-sm hover:bg-[#e85c70] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending
            ? <Loader size={13} className="animate-spin" />
            : <Send size={13} />}
          Enviar
        </button>
      </div>
      {sent && (
        <div className="flex items-center gap-2 text-xs text-[#4ade80]">
          <CheckCircle size={13} /> E-mail enviado com sucesso!
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-xs text-[#f87171]">
          <AlertCircle size={13} /> {err}
        </div>
      )}
    </div>
  );
}

export function TemplatesPage() {
  const [selected, setSelected] = useState<TemplateMeta | null>(null);
  const [vars, setVars]         = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState(0);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
    staleTime: Infinity,
  });

  function handleSelect(t: TemplateMeta) {
    const defaults: Record<string, string> = {};
    t.vars.forEach((v) => { defaults[v.key] = v.default; });
    setSelected(t);
    setVars(defaults);
    setPreviewKey((k) => k + 1);
  }

  function handleVarChange(key: string, value: string) {
    setVars((prev) => ({ ...prev, [key]: value }));
  }

  const previewUrl = selected ? fetchTemplatePreviewUrl(selected.name, vars) : null;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-white">Templates</h1>
        <p className="text-sm text-white/35 mt-1">Visualize e teste os templates de e-mail</p>
      </div>

      <div className="flex gap-5 flex-1 min-h-0" style={{ height: "calc(100vh - 160px)" }}>
        {/* Lista de templates */}
        <div className="w-56 shrink-0 bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Templates</p>
          </div>
          <TemplateList
            templates={templates}
            selected={selected}
            onSelect={handleSelect}
            loading={isLoading}
          />
        </div>

        {/* Painel direito */}
        {selected ? (
          <div className="flex-1 flex gap-5 min-w-0">
            {/* Variáveis + test send */}
            <div className="w-72 shrink-0 flex flex-col gap-5">
              <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Eye size={14} className="text-[#f86d83]" />
                  <p className="text-sm font-bold text-white">Variáveis</p>
                </div>
                <VarsForm template={selected} values={vars} onChange={handleVarChange} />
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="mt-4 w-full py-2 text-xs font-bold text-[#f86d83] border border-[#f86d83]/20 rounded-sm hover:bg-[#f86d83]/5 transition-colors"
                >
                  Atualizar preview
                </button>
              </div>

              <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm p-5">
                <TestSend template={selected} vars={vars} />
              </div>
            </div>

            {/* Preview iframe */}
            <div className="flex-1 bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Eye size={13} className="text-white/30" />
                <span className="text-[11px] text-white/30 font-mono">{selected.name}</span>
              </div>
              <div className="flex-1">
                <iframe
                  key={previewKey}
                  src={previewUrl ?? ""}
                  className="w-full h-full border-0"
                  title="Preview do template"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-[#0e0f14] border border-white/[0.07] rounded-sm flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center">
              <FileText size={22} className="text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/40">Selecione um template</p>
              <p className="text-xs text-white/20 mt-1">Escolha um template à esquerda para visualizar o preview.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
