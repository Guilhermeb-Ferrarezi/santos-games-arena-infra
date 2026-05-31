import { useState, useMemo } from "react";
import { Search, Mail, User } from "lucide-react";
import { MOCK_USERS, MOCK_LOGS, type UserSummary } from "@/lib/mock";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABEL: Record<string, string> = {
  "welcome":              "Boas-vindas",
  "password-reset":       "Reset",
  "login-notification":   "Acesso",
  "password-changed":     "Senha",
  "email-change":         "E-mail",
};

function UserRow({ user, onClick, selected }: { user: UserSummary; onClick: () => void; selected: boolean }) {
  return (
    <tr
      className={`cursor-pointer transition-colors border-b border-white/[0.04] ${selected ? "bg-[#f86d83]/5" : "hover:bg-white/[0.02]"}`}
      onClick={onClick}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center text-white/40 text-xs font-bold uppercase shrink-0">
            {user.login[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">{user.login}</p>
            <p className="text-xs text-white/35 font-mono">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-sm text-white/50">{user.emailCount}</span>
      </td>
      <td className="px-5 py-4">
        {user.lastEmailAt
          ? <span className="text-xs text-white/30">{formatDistanceToNow(new Date(user.lastEmailAt), { locale: ptBR, addSuffix: true })}</span>
          : <span className="text-xs text-white/20">—</span>}
      </td>
      <td className="px-5 py-4">
        {user.lastEmailType && user.emailCount > 0
          ? <Badge variant="muted">{TYPE_LABEL[user.lastEmailType]}</Badge>
          : <span className="text-xs text-white/20">—</span>}
      </td>
    </tr>
  );
}

export function UsersPage() {
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<UserSummary | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_USERS.filter((u) =>
      !q || u.login.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [search]);

  const userLogs = useMemo(() =>
    selected ? MOCK_LOGS.filter((l) => l.login === selected.login) : [],
    [selected]
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Usuários</h1>
        <p className="text-sm text-white/35 mt-1">{MOCK_USERS.length} usuários · histórico de e-mails</p>
      </div>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <Input
              placeholder="Buscar login ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="bg-[#0e0f14] border border-white/[0.07] rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Usuário", "E-mails", "Último envio", "Último tipo"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    selected={selected?.id === u.id}
                    onClick={() => setSelected(selected?.id === u.id ? null : u)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalhe */}
        {selected && (
          <div className="w-80 shrink-0">
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
              <div className="divide-y divide-white/[0.04]">
                <p className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Histórico</p>
                {userLogs.length === 0 && (
                  <div className="px-5 py-8 text-center text-white/20 text-sm">Nenhum e-mail enviado</div>
                )}
                {userLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-white/60">{TYPE_LABEL[log.type] ?? log.type}</span>
                      <Badge variant={log.status === "sent" ? "success" : log.status === "failed" ? "danger" : "warning"}>
                        {log.status === "sent" ? "OK" : log.status === "failed" ? "Erro" : "…"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-white/25">
                      {log.sentAt ? formatDistanceToNow(new Date(log.sentAt), { locale: ptBR, addSuffix: true }) : "—"}
                    </p>
                    {log.errorMsg && (
                      <p className="text-[10px] text-[#f87171] mt-1 font-mono">{log.errorMsg}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
