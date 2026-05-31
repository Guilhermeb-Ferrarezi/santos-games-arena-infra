import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Search, AlertCircle, CheckCircle, Clock, Loader } from "lucide-react";
import { fetchLogs, type EmailLog } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABEL: Record<string, string> = {
  "welcome":              "Boas-vindas",
  "password-reset":       "Reset de senha",
  "login-notification":   "Notif. de acesso",
  "password-changed":     "Senha alterada",
  "email-change":         "Troca de e-mail",
};

function StatusBadge({ status }: { status: EmailLog["status"] }) {
  if (status === "sent")   return <Badge variant="success">Enviado</Badge>;
  if (status === "failed") return <Badge variant="danger">Falhou</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}

function StatusIcon({ status }: { status: EmailLog["status"] }) {
  if (status === "sent")   return <CheckCircle size={15} className="text-[#4ade80]" />;
  if (status === "failed") return <AlertCircle size={15} className="text-[#f87171]" />;
  return <Clock size={15} className="text-[#facc15]" />;
}

const LIMIT = 20;

export function EmailsPage() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [typeFilter, setType]     = useState("all");
  const [statusFilter, setStatus] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["logs", page, search, typeFilter, statusFilter],
    queryFn:  () => fetchLogs({ page, limit: LIMIT, search, type: typeFilter, status: statusFilter }),
    placeholderData: (prev) => prev,
  });

  function handleFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Log de E-mails</h1>
        <p className="text-sm text-white/35 mt-1">
          {data ? `${data.total} registros` : "Carregando…"}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <Input
            placeholder="Buscar e-mail ou login..."
            value={search}
            onChange={(e) => handleFilter(() => setSearch(e.target.value))}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => handleFilter(() => setType(e.target.value))}>
          <option value="all">Todos os tipos</option>
          <option value="welcome">Boas-vindas</option>
          <option value="password-reset">Reset de senha</option>
          <option value="login-notification">Notif. de acesso</option>
          <option value="password-changed">Senha alterada</option>
          <option value="email-change">Troca de e-mail</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => handleFilter(() => setStatus(e.target.value))}>
          <option value="all">Todos os status</option>
          <option value="sent">Enviados</option>
          <option value="failed">Falhas</option>
          <option value="pending">Pendentes</option>
        </Select>
      </div>

      <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader size={20} className="text-[#f86d83] animate-spin" />
          </div>
        )}
        {isError && (
          <div className="text-center py-16 text-white/20 text-sm">Erro ao carregar dados.</div>
        )}
        {!isLoading && !isError && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Status", "Destinatário", "Badge", "Tipo", "Login", "Enviado em", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data?.data.map((log) => (
                <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5"><StatusIcon status={log.status} /></td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white/70 font-mono">{log.to}</span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={log.status} /></td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white/50">{TYPE_LABEL[log.emailType]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-white/35 font-mono">{log.login}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-white/30">
                      {log.sentAt
                        ? formatDistanceToNow(new Date(log.sentAt), { locale: ptBR, addSuffix: true })
                        : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {log.errorMsg && (
                      <span className="text-[10px] text-[#f87171] font-mono bg-[#f87171]/10 px-2 py-0.5 rounded-sm">
                        {log.errorMsg}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && !isError && data?.data.length === 0 && (
          <div className="text-center py-16 text-white/20">
            <Mail size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum registro encontrado</p>
          </div>
        )}
      </div>

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={LIMIT}
          onChange={setPage}
        />
      )}
    </div>
  );
}
