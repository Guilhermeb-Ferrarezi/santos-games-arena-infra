import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Mail, Loader } from "lucide-react";
import { fetchUsers, type UserSummary } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/Pagination";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABEL: Record<string, string> = {
  "welcome":            "Boas-vindas",
  "password-reset":     "Reset",
  "login-notification": "Acesso",
  "password-changed":   "Senha",
  "email-change":       "E-mail",
};

const LIMIT = 20;

export function UsersPage() {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<UserSummary | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", page, search],
    queryFn:  () => fetchUsers({ page, limit: LIMIT, search }),
    placeholderData: (prev) => prev,
  });

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
    setSelected(null);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Usuários</h1>
        <p className="text-sm text-white/35 mt-1">
          {data ? `${data.total} usuários · histórico de e-mails` : "Carregando…"}
        </p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <Input
              placeholder="Buscar login ou e-mail..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader size={20} className="text-[#f86d83] animate-spin" />
              </div>
            )}
            {isError && (
              <div className="text-center py-12 text-white/20 text-sm">Erro ao carregar dados.</div>
            )}
            {!isLoading && !isError && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Usuário", "E-mails", "Último envio", "Último tipo"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((u) => (
                    <tr
                      key={u.login}
                      className={`cursor-pointer transition-colors border-b border-white/[0.04] ${selected?.login === u.login ? "bg-[#f86d83]/5" : "hover:bg-white/[0.02]"}`}
                      onClick={() => setSelected(selected?.login === u.login ? null : u)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center text-white/40 text-xs font-bold uppercase shrink-0">
                            {u.login[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white/80">{u.login}</p>
                            <p className="text-xs text-white/35 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-white/50">{u.emailCount}</span>
                      </td>
                      <td className="px-5 py-4">
                        {u.lastEmailAt
                          ? <span className="text-xs text-white/30">{formatDistanceToNow(new Date(u.lastEmailAt), { locale: ptBR, addSuffix: true })}</span>
                          : <span className="text-xs text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        {u.lastEmailType
                          ? <Badge variant="muted">{TYPE_LABEL[u.lastEmailType]}</Badge>
                          : <span className="text-xs text-white/20">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!isLoading && !isError && data?.data.length === 0 && (
              <div className="text-center py-16 text-white/20">
                <Mail size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum usuário encontrado</p>
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

        {selected && (
          <div className="w-72 shrink-0">
            <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-sm bg-[#f86d83]/10 flex items-center justify-center text-[#f86d83] text-sm font-bold uppercase">
                    {selected.login[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selected.login}</p>
                    <p className="text-xs text-white/35 font-mono">{selected.email}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-center">
                  <div className="flex-1 bg-white/5 rounded-sm py-2">
                    <p className="text-lg font-black text-white">{selected.emailCount}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">e-mails</p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Último envio</p>
                {selected.lastEmailAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/60">{TYPE_LABEL[selected.lastEmailType]}</span>
                    <span className="text-[11px] text-white/25">
                      {formatDistanceToNow(new Date(selected.lastEmailAt), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-white/20">Nenhum e-mail enviado</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
