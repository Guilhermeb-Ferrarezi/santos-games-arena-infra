import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelOrder,
  createCardOrder,
  createOrder,
  createPayIntent,
  getCustomerInfo,
  getOrder,
  getPayIntent,
  getProductById,
  getSession,
  listProducts,
  validateCoupon,
  type CreateOrderResult,
  type CustomerInfo,
  type Order,
  type Product,
  type Session
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const authWebUrl =
  import.meta.env.VITE_AUTH_WEB_URL ??
  (typeof window !== "undefined" && window.location.hostname.includes("santos-games.com")
    ? "https://auth.santos-games.com"
    : "http://localhost:5173");

function redirectToLogin() {
  const redirectUri = window.location.origin;
  window.location.href = `${authWebUrl}?client_id=checkout-web&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

function navigate(path: string, state: object = {}) {
  window.history.pushState(state, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

// ── Ícones ────────────────────────────────────────────────────────────────────

function PixIcon({ size = 18 }: { size?: number }) {
  return <img src="/pix.svg" alt="PIX" width={size} height={size} style={{ display: "inline-block" }} />;
}

function CreditCardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function MenuIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <span className="text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

const WA_SUPPORT = "https://wa.me/5516991069776";

function SgHeader({
  userLogin,
  onBack
}: {
  userLogin?: string;
  onBack?: () => void;
}) {
  const [logoErr, setLogoErr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border/40 bg-surface-1 relative z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-0 h-14">
          {/* Esquerda */}
          <div className="flex items-center gap-3 h-full">
            {/* Hambúrguer — mobile */}
            <button
              className="sm:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              {menuOpen ? <XIcon /> : <MenuIcon />}
            </button>

            {/* Logo + branding */}
            <a href="https://santos-games.com" className="flex items-center gap-3 h-full">
              {!logoErr && (
                <img
                  src="/sga-logo.png"
                  alt="SGA"
                  className="h-8 object-contain"
                  onError={() => setLogoErr(true)}
                />
              )}
              <div className="hidden sm:flex flex-col justify-center leading-none">
                <span className="font-display font-bold text-sm tracking-widest uppercase text-foreground">Santos Games</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Arena</span>
              </div>
            </a>

            {/* Botão Voltar — quando está num step do checkout */}
            {onBack && (
              <button
                onClick={onBack}
                className="hidden sm:flex items-center gap-1.5 ml-4 text-sm text-muted-foreground hover:text-foreground transition-colors border-l border-border/40 pl-4"
              >
                <ArrowLeftIcon size={14} />
                <span>Voltar</span>
              </button>
            )}
          </div>

          {/* Direita */}
          {userLogin && (
            <span className="text-sm text-muted-foreground">{userLogin}</span>
          )}
        </div>
      </header>

      {/* Sidebar mobile — desliza da esquerda */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute top-0 left-0 h-full w-64 bg-surface-1 border-r border-border/40 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Topo sidebar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-sm tracking-widest uppercase">Santos Games</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Arena</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon size={18} />
              </button>
            </div>

            {/* Usuário */}
            {userLogin && (
              <div className="px-5 py-4 border-b border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Logado como</p>
                <p className="text-sm font-semibold truncate">{userLogin}</p>
              </div>
            )}

            {/* Nav */}
            <nav className="flex flex-col gap-0.5 p-3 flex-1">
              {onBack && (
                <button
                  onClick={() => { setMenuOpen(false); onBack(); }}
                  className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors text-left w-full"
                >
                  <ArrowLeftIcon size={14} />
                  Voltar
                </button>
              )}
              <a
                href="https://santos-games.com"
                className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <span className="text-xs">⌂</span>
                Home
              </a>
              <a
                href={WA_SUPPORT}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <span className="text-[#25d366] text-sm leading-none">●</span>
                Suporte
              </a>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── PIX countdown badge ───────────────────────────────────────────────────────

function PixCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (remaining === 0) {
    return (
      <span className="border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        PIX expirado
      </span>
    );
  }

  const cls =
    remaining > 120
      ? "border-success/40 bg-success/10 text-success"
      : remaining > 60
        ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
        : "border-destructive/40 bg-destructive/10 text-destructive";

  return (
    <span className={`border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

// ── PIX modal (overlay) ────────────────────────────────────────────────────────

function PixModal({
  order,
  pixCode,
  pixCodeBase64,
  pixExpiresAt,
  onClose
}: {
  order: Order;
  pixCode: string;
  pixCodeBase64: string;
  pixExpiresAt: string;
  onClose: (paid: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const copyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      if (copyRef.current) clearTimeout(copyRef.current);
      copyRef.current = setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleCancel() {
    if (order.status === "pending") {
      setCancelling(true);
      setCancelError(false);
      try {
        await cancelOrder(order.id);
      } catch {
        setCancelling(false);
        setCancelError(true);
        return;
      }
    }
    onClose(false);
  }

  if (order.status === "paid") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-sm border border-border/60 bg-surface-1 p-8 text-center flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckIcon size={32} />
          </div>
          <h2 className="text-3xl font-display font-bold text-success">Pagamento confirmado!</h2>
          <p className="text-sm text-muted-foreground">{order.description}</p>
          <p className="text-2xl font-display font-bold text-primary">{formatCurrency(order.amountCents)}</p>
          <Button className="mt-2 w-full" onClick={() => onClose(true)}>Ver outros planos</Button>
        </div>
      </div>
    );
  }

  if (order.status === "expired" || order.status === "failed" || order.status === "cancelled") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-sm border border-border/60 bg-surface-1 p-8 text-center flex flex-col items-center gap-4">
          <p className="text-destructive font-semibold">PIX expirado ou inválido.</p>
          <Button onClick={() => onClose(false)}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm border border-border/60 bg-surface-1 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2 text-[#32BCAD]">
            <PixIcon size={18} />
            <span className="font-display font-bold tracking-wide text-foreground">PAGAMENTO PIX</span>
          </div>
          <PixCountdown expiresAt={pixExpiresAt} />
        </div>

        {/* QR code */}
        <div className="flex justify-center bg-white p-5">
          <img src={pixCodeBase64} alt="QR Code PIX" className="h-48 w-48" />
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pedido #{order.id}</span>
            <span className="font-semibold text-foreground">{formatCurrency(order.amountCents)}</span>
          </div>

          <p className="text-xs text-muted-foreground text-center border border-border/40 bg-surface-2 px-3 py-2 font-mono truncate">
            {pixCode.slice(0, 40)}…
          </p>

          <Button className="w-full transition-all" onClick={handleCopy}>
            {copied ? (
              <span className="flex items-center gap-2"><CheckIcon size={14} /> Copiado!</span>
            ) : (
              "Copiar código PIX"
            )}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Aguardando confirmação do pagamento…
          </p>

          {cancelError && (
            <p className="text-center text-xs text-destructive">
              Erro ao cancelar. Tente novamente.
            </p>
          )}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-1.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {cancelling ? "Cancelando…" : "Cancelar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order status (polling + modal) ────────────────────────────────────────────

function OrderModal({
  orderId,
  initialPix,
  onClose
}: {
  orderId: number;
  initialPix?: CreateOrderResult;
  onClose: (paid: boolean) => void;
}) {
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
    // para de fazer polling quando cancelado/expirado/pago
    initialData: initialPix
      ? {
          id: orderId,
          productId: "",
          description: "",
          amountCents: initialPix.amountCents,
          status: "pending" as const,
          pixCode: initialPix.pixCode,
          pixCodeBase64: initialPix.pixCodeBase64,
          pixExpiresAt: initialPix.pixExpiresAt,
          createdAt: new Date().toISOString()
        }
      : undefined
  });

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <Spinner />
      </div>
    );
  }

  if (order.status === "pending" && order.pixCode && order.pixCodeBase64 && order.pixExpiresAt) {
    return (
      <PixModal
        order={order}
        pixCode={order.pixCode}
        pixCodeBase64={order.pixCodeBase64}
        pixExpiresAt={order.pixExpiresAt}
        onClose={(paid) => onClose(paid)}
      />
    );
  }

  return (
    <PixModal
      order={order}
      pixCode=""
      pixCodeBase64=""
      pixExpiresAt={new Date(Date.now() + 1000).toISOString()}
      onClose={(paid) => onClose(paid)}
    />
  );
}

// ── Payment page ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-surface-2 border border-border/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors";

function PaymentPage({
  product,
  session,
  savedCustomer,
  onCancel,
  onSubmit,
  isPending,
  mutationError
}: {
  product: Product;
  session: Session;
  savedCustomer?: CustomerInfo | null;
  onCancel: () => void;
  onSubmit: (data: {
    name: string; email: string; taxId: string; cellphone: string;
    method: "pix" | "card";
    saveInfo: boolean;
    couponCode?: string;
  }) => void;
  isPending: boolean;
  mutationError?: string;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [name, setName] = useState(savedCustomer?.name ?? "");
  const [email, setEmail] = useState(session.user?.email ?? "");
  const [taxId, setTaxId] = useState(
    savedCustomer?.taxId
      ? savedCustomer.taxId.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      : ""
  );
  const [cellphone, setCellphone] = useState(
    savedCustomer?.cellphone
      ? savedCustomer.cellphone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
      : ""
  );
  const [saveInfo, setSaveInfo] = useState(!savedCustomer);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(code);
      setAppliedCoupon({ code: result.code, discountPercent: result.discountPercent });
      setCouponInput("");
    } catch {
      setCouponError("Cupom inválido ou expirado.");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  const productDiscount = product.discountPercent ?? 0;
  const afterProductDiscount = productDiscount > 0
    ? Math.round(product.amountCents * (1 - productDiscount / 100))
    : product.amountCents;
  const couponDiscount = appliedCoupon?.discountPercent ?? 0;
  const finalAmount = couponDiscount > 0
    ? Math.round(afterProductDiscount * (1 - couponDiscount / 100))
    : afterProductDiscount;
  const totalSaved = product.amountCents - finalAmount;

  type FieldErrors = {
    name?: string; email?: string; taxId?: string; cellphone?: string;
  };
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, true>>>({});
  const [submitted, setSubmitted] = useState(false);

  function formatCpf(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  function validateCpf(raw: string): boolean {
    const d = raw.replace(/\D/g, "");
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const calc = (len: number) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += parseInt(d[i]) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
  }

  function validate(vals: { name: string; email: string; taxId: string; cellphone: string }) {
    const e: FieldErrors = {};
    if (vals.name.trim().length < 3) e.name = "Informe seu nome completo.";
    if (!/\S+@\S+\.\S+/.test(vals.email.trim())) e.email = "E-mail inválido.";
    if (!validateCpf(vals.taxId)) e.taxId = "CPF inválido.";
    if (vals.cellphone.replace(/\D/g, "").length < 10) e.cellphone = "Telefone inválido.";
    return e;
  }

  const allErrors = validate({ name, email, taxId, cellphone });
  const errors: FieldErrors = submitted
    ? allErrors
    : Object.fromEntries(Object.entries(allErrors).filter(([k]) => touched[k as keyof FieldErrors]));

  function updateField(_field: keyof FieldErrors, setter: (v: string) => void, newValue: string) {
    setter(newValue);
  }

  function handleBlur(field: keyof FieldErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.keys(allErrors).length > 0) return;
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      taxId: taxId.replace(/\D/g, ""),
      cellphone: cellphone.replace(/\D/g, ""),
      method: paymentMethod,
      saveInfo,
      couponCode: appliedCoupon?.code
    });
  }

  const features = product.features?.length > 0
    ? product.features
    : [product.description, "Acesso imediato após confirmação", "Pagamento PIX sem juros"].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader userLogin={session.user?.login} onBack={onCancel} />

      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="flex w-full max-w-4xl flex-col gap-8 md:flex-row md:items-start md:gap-10">

          {/* ── Coluna esquerda: form ── */}
          <div className="w-full min-w-0 max-w-sm mx-auto md:mx-0">
            {/* Mobile: product info */}
            <div className="mb-6 text-center md:hidden">
              <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
                DADOS PARA PAGAMENTO
              </span>
              <h2 className="mt-3 text-2xl font-display font-bold">{product.name}</h2>
              <p className="mt-1 text-4xl font-display font-bold text-primary">
                {formatCurrency(product.amountCents)}
              </p>
            </div>

            {/* Desktop: só o label */}
            <div className="mb-5 hidden md:block">
              <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
                DADOS PARA PAGAMENTO
              </span>
            </div>

            {/* Método de pagamento */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="relative flex items-center justify-center gap-2 border border-border/40 bg-surface-2/50 px-3 py-3 text-sm font-semibold text-muted-foreground/40 cursor-not-allowed select-none">
                <CreditCardIcon />
                <span>Cartão</span>
                <span className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wider bg-muted-foreground/20 text-muted-foreground/60 px-1 py-0.5 leading-none">Em breve</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentMethod("pix")}
                className={`flex items-center justify-center gap-2 border px-3 py-3 text-sm font-semibold transition-colors ${paymentMethod === "pix" ? "border-[#32BCAD]/60 bg-[#32BCAD]/10 text-[#32BCAD]" : "border-border/60 bg-surface-1 text-muted-foreground hover:text-foreground"}`}
              >
                <PixIcon />
                <span>PIX</span>
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="border border-border/60 bg-surface-1 p-5 flex flex-col gap-4"
            >
              <FormField label="Nome completo" error={errors.name}>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  className={inputCls}
                  onChange={(e) => updateField("name", setName, e.target.value)}
                  onBlur={() => handleBlur("name")}
                  disabled={isPending}
                />
              </FormField>

              <FormField label="E-mail" error={errors.email}>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  className={inputCls}
                  onChange={(e) => updateField("email", setEmail, e.target.value)}
                  onBlur={() => handleBlur("email")}
                  disabled={isPending}
                />
              </FormField>

              <FormField label="CPF" error={errors.taxId}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={taxId}
                  className={inputCls}
                  onChange={(e) => updateField("taxId", setTaxId, formatCpf(e.target.value))}
                  onBlur={() => handleBlur("taxId")}
                  disabled={isPending}
                />
              </FormField>

              <FormField label="Telefone" error={errors.cellphone}>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={cellphone}
                  className={inputCls}
                  onChange={(e) => updateField("cellphone", setCellphone, formatPhone(e.target.value))}
                  onBlur={() => handleBlur("cellphone")}
                  disabled={isPending}
                />
              </FormField>

              {paymentMethod === "card" && (
                <div className="flex items-start gap-3 border border-border/40 bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                  <CreditCardIcon size={16} />
                  <p className="leading-snug">
                    Você será redirecionado para a página segura de pagamento para inserir os dados do cartão.
                    Seus dados pessoais acima serão enviados automaticamente.
                  </p>
                </div>
              )}

              {/* Cupom de desconto */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Cupom de desconto</span>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between border border-green-600/40 bg-green-950/30 px-3 py-2 text-sm">
                    <span className="text-green-400 font-mono font-semibold">{appliedCoupon.code} <span className="font-normal text-green-500">(-{appliedCoupon.discountPercent}%)</span></span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      onClick={() => setAppliedCoupon(null)}
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código do cupom"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyCoupon())}
                      className={inputCls + " flex-1"}
                      disabled={isPending || couponLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyCoupon}
                      disabled={!couponInput.trim() || couponLoading || isPending}
                    >
                      {couponLoading ? <Spinner /> : "Aplicar"}
                    </Button>
                  </div>
                )}
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-xs text-muted-foreground">Salvar meus dados para próximas compras</span>
              </label>

              {mutationError && (
                <p className="text-xs text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2">
                  {mutationError}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full gap-2" disabled={isPending}>
                {isPending ? (
                  <>
                    <Spinner />
                    <span>{paymentMethod === "card" ? "Processando…" : "Gerando PIX…"}</span>
                  </>
                ) : paymentMethod === "card" ? (
                  <span className="flex items-center gap-2">
                    <CreditCardIcon size={16} />
                    Pagar com Cartão
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PixIcon size={16} />
                    Gerar PIX
                  </span>
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={onCancel}
              className="mt-3 w-full py-2 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>

          {/* ── Coluna direita: card de resumo ── */}
          <div className="w-full max-w-sm mx-auto md:max-w-none md:flex-1 md:mx-0">
            <div className="border border-border/60 bg-surface-1 p-6 flex flex-col gap-5">
              {/* Nome do produto */}
              <h2 className="text-3xl font-display font-bold leading-tight">{product.name}</h2>

              {/* Features */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  O que está incluso
                </p>
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[#32BCAD]">
                      <CheckIcon size={13} />
                    </span>
                    <span className="text-sm text-muted-foreground leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              {/* Imagem do produto */}
              {product.imageUrl && (
                <img src={product.imageUrl} alt={product.name} className="w-full h-36 object-cover rounded" />
              )}

              {/* Divisor */}
              <div className="border-t border-border/40" />

              {/* Preços */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className={totalSaved > 0 ? "line-through opacity-60" : ""}>{formatCurrency(product.amountCents)}</span>
                </div>
                {productDiscount > 0 && (
                  <div className="flex justify-between text-green-500 text-xs">
                    <span>Desconto produto ({productDiscount}%)</span>
                    <span>-{formatCurrency(product.amountCents - afterProductDiscount)}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between text-green-500 text-xs">
                    <span>Cupom {appliedCoupon.code} ({appliedCoupon.discountPercent}%)</span>
                    <span>-{formatCurrency(afterProductDiscount - finalAmount)}</span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div className="border-t border-border/40" />

              {/* Total */}
              <div className="flex justify-between font-semibold">
                <span>Total hoje</span>
                <span className="text-primary text-lg font-display font-bold">
                  {formatCurrency(finalAmount)}
                </span>
              </div>

              {/* Nota */}
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Pagamento único. Ao pagar, você concorda com os termos de uso da Santos Games.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// ── Intent loader ─────────────────────────────────────────────────────────────

function IntentLoader({
  token,
  session,
  onLoaded,
  onError
}: {
  token: string;
  session: Session;
  onLoaded: (product: Product) => void;
  onError: () => void;
}) {
  const { data: product, error } = useQuery({
    queryKey: ["pay-intent", token],
    queryFn: () => getPayIntent(token),
    retry: false
  });

  useEffect(() => {
    if (product) onLoaded(product);
  }, [product]);

  useEffect(() => {
    if (error) onError();
  }, [error]);

  return <LoadingScreen />;
}

// ── Products page ─────────────────────────────────────────────────────────────

function ProductCard({ product, onBuy, isLoading }: { product: Product; onBuy: () => void; isLoading?: boolean }) {
  const features = (product.features?.length > 0 ? product.features : [product.description].filter(Boolean)).slice(0, 4);
  const discountedCents = product.discountPercent
    ? Math.round(product.amountCents * (1 - product.discountPercent / 100))
    : null;

  return (
    <div className={`flex flex-col bg-surface-1 overflow-hidden transition-all hover:border-primary/60 border ${product.isCorujao ? "border-primary/50 border-t-2" : "border-border/60"}`}>
      {/* Imagem hero */}
      <div className="relative cursor-pointer" onClick={onBuy}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-52 object-cover" />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-surface-2 to-surface-3 flex items-center justify-center">
            <span className="font-display font-bold text-2xl text-muted-foreground/50 uppercase text-center px-4">{product.name}</span>
          </div>
        )}
        {product.isCorujao && (
          <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-2 py-1">
            ⚡ Corujão
          </span>
        )}
        {product.discountPercent ? (
          <span className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1">
            -{product.discountPercent}%
          </span>
        ) : null}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-6 gap-4">
        <h3 className="text-2xl font-display font-bold leading-tight">{product.name}</h3>

        {/* Preço */}
        <div>
          <p className="text-4xl font-display font-bold text-primary leading-none">
            {formatCurrency(discountedCents ?? product.amountCents)}
          </p>
          {discountedCents && (
            <p className="mt-1 text-sm text-muted-foreground line-through">
              {formatCurrency(product.amountCents)}
            </p>
          )}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-[#32BCAD] text-xs shrink-0">✓</span>
                <span className="text-sm text-muted-foreground leading-snug">{f}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button className="w-full gap-2" size="lg" onClick={onBuy} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner />
                <span>Aguarde…</span>
              </>
            ) : (
              <>Garantir agora →</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({
  session,
  onSelectProduct,
  intentLoading,
  intentError
}: {
  session: Session;
  onSelectProduct: (product: Product) => void;
  intentLoading?: boolean;
  intentError?: boolean;
}) {
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background">
      <SgHeader userLogin={session.user?.login ?? undefined} />

      {error ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <p className="text-destructive">Erro ao carregar produtos.</p>
        </div>
      ) : (
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-display font-bold">Escolha seu plano</h2>
            <p className="mt-2 text-muted-foreground">Garanta sua vaga agora. Vagas limitadas.</p>
          </div>

          {intentError && (
            <p className="mb-6 text-center text-sm text-destructive border border-destructive/30 bg-destructive/10 px-4 py-2 max-w-md mx-auto">
              Erro ao iniciar pagamento. Tente novamente.
            </p>
          )}

          {products.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum produto disponível no momento.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onBuy={() => onSelectProduct(p)} isLoading={intentLoading} />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// ── Product detail page ───────────────────────────────────────────────────────

function ProductDetailPage({
  productId,
  session,
  onBuy,
}: {
  productId: number;
  session: Session;
  onBuy: (product: Product) => void;
}) {
  const intentMutation = useMutation({
    mutationFn: ({ productId }: { productId: number }) => createPayIntent(productId),
    onSuccess: (result) => navigate(`/pay/${result.token}`),
  });

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductById(productId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SgHeader />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-destructive">Produto não encontrado.</p>
        </div>
      </div>
    );
  }

  const discountedCents = product.discountPercent
    ? Math.round(product.amountCents * (1 - product.discountPercent / 100))
    : product.amountCents;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader userLogin={session.user?.login ?? undefined} onBack={() => navigate("/")} />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm border border-border/60 bg-surface-1 overflow-hidden">
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" />
          )}
          <div className="flex flex-col gap-4 p-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">{product.name}</h1>
              {product.description && (
                <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
              )}
            </div>
            {product.features && product.features.length > 0 && (
              <ul className="flex flex-col gap-1">
                {product.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 text-[#32BCAD]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border/40 pt-3">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(discountedCents)}
              </p>
              {product.discountPercent && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(product.amountCents)}
                </p>
              )}
            </div>
            <button
              onClick={() => intentMutation.mutate({ productId: product.id })}
              disabled={intentMutation.isPending}
              className="flex w-full items-center justify-center gap-2 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {intentMutation.isPending ? <Spinner /> : "Comprar agora"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Pay order page ────────────────────────────────────────────────────────────

function PayOrderPage({ orderId, session }: { orderId: number; session: Session }) {
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SgHeader userLogin={session.user?.login ?? undefined} />
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-destructive">Pedido não encontrado ou acesso negado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader userLogin={session.user?.login ?? undefined} />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <OrderModal orderId={orderId} onClose={() => navigate("/")} />
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

type AppState =
  | { page: "products" }
  | { page: "product"; productId: number }
  | { page: "intent"; token: string }
  | { page: "payment"; product: Product }
  | { page: "pay-order"; orderId: number }
  | { page: "order"; orderId: number; product: Product; initialPix?: CreateOrderResult };

export function CheckoutApp() {
  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppState>({ page: "products" });

  useEffect(() => {
    function handlePath() {
      const path = window.location.pathname;
      const produtoMatch  = path.match(/^\/produto\/(\d+)$/);
      const payOrderMatch = path.match(/^\/pay\/(\d+)$/);
      const intentMatch   = path.match(/^\/pay\/([a-f0-9]+)$/);
      const orderMatch    = path.match(/^\/order\/(\d+)$/);

      if (produtoMatch) {
        setAppState({ page: "product", productId: parseInt(produtoMatch[1], 10) });
      } else if (payOrderMatch) {
        setAppState({ page: "pay-order", orderId: parseInt(payOrderMatch[1], 10) });
      } else if (intentMatch) {
        setAppState({ page: "intent", token: intentMatch[1] });
      } else if (orderMatch) {
        navigate(`/pay/${orderMatch[1]}`);
      } else {
        setAppState({ page: "products" });
      }
    }
    handlePath();
    window.addEventListener("popstate", handlePath);
    return () => window.removeEventListener("popstate", handlePath);
  }, []);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false
  });

  const { data: savedCustomer } = useQuery({
    queryKey: ["customer-info"],
    queryFn: getCustomerInfo,
    enabled: !!session?.authenticated,
    retry: false
  });

  const intentMutation = useMutation({
    mutationFn: (productId: number) => createPayIntent(productId),
    onSuccess: (result) => navigate(`/pay/${result.token}`)
  });

  const buyMutation = useMutation({
    mutationFn: (vars: { productId: number; product: Product; customer: { name: string; email: string; taxId: string; cellphone: string }; saveInfo: boolean; couponCode?: string }) =>
      createOrder(vars.productId, vars.customer, vars.saveInfo, vars.couponCode).then((r) => ({ ...r, product: vars.product })),
    onSuccess: (result) => {
      queryClient.setQueryData(["order", result.orderId], {
        id: result.orderId,
        productId: "",
        description: "",
        amountCents: result.amountCents,
        status: "pending",
        pixCode: result.pixCode,
        pixCodeBase64: result.pixCodeBase64,
        pixExpiresAt: result.pixExpiresAt,
        createdAt: new Date().toISOString()
      });
      // atualiza URL sem disparar handlePath (pushState não dispara popstate nativo)
      window.history.pushState({ pix: result, product: result.product }, "", `/pay/${result.orderId}`);
      // seta estado diretamente para garantir que o fundo é a PaymentPage
      setAppState({ page: "order", orderId: result.orderId, product: result.product, initialPix: result });
    }
  });

  const cardMutation = useMutation({
    mutationFn: (vars: { productId: number; product: Product; customer: { name: string; email: string; taxId: string; cellphone: string }; saveInfo: boolean; couponCode?: string }) =>
      createCardOrder(vars.productId, vars.customer, vars.saveInfo, vars.couponCode),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    }
  });

  if (isLoading) return <LoadingScreen />;

  if (!session?.authenticated || !session.user) {
    redirectToLogin();
    return <LoadingScreen />;
  }

  if (appState.page === "product") {
    return (
      <ProductDetailPage
        productId={appState.productId}
        session={session}
        onBuy={(product) => setAppState({ page: "payment", product })}
      />
    );
  }

  if (appState.page === "pay-order") {
    return <PayOrderPage orderId={appState.orderId} session={session} />;
  }

  if (appState.page === "intent") {
    return <IntentLoader token={appState.token} session={session} onLoaded={(product) => setAppState({ page: "payment", product })} onError={() => navigate("/")} />;
  }

  if (appState.page === "payment") {
    return (
      <PaymentPage
        product={appState.product}
        session={session}
        savedCustomer={savedCustomer}
        isPending={buyMutation.isPending || cardMutation.isPending}
        mutationError={
          buyMutation.error ? "Erro ao gerar PIX. Tente novamente." :
          cardMutation.error ? (() => {
            const d = (cardMutation.error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
            if (d?.error === "card_declined") return "Cartão recusado. Verifique os dados ou use outro cartão.";
            if (d?.message) return `Erro ao processar cartão: ${d.message}`;
            return "Erro ao processar cartão. Tente novamente.";
          })() : undefined
        }
        onCancel={() => navigate("/")}
        onSubmit={(data) => {
          if (data.method === "card") {
            cardMutation.mutate({
              productId: appState.product.id,
              product: appState.product,
              customer: { name: data.name, email: data.email, taxId: data.taxId, cellphone: data.cellphone },
              saveInfo: data.saveInfo,
              couponCode: data.couponCode
            });
          } else {
            buyMutation.mutate({
              productId: appState.product.id,
              product: appState.product,
              customer: { name: data.name, email: data.email, taxId: data.taxId, cellphone: data.cellphone },
              saveInfo: data.saveInfo,
              couponCode: data.couponCode
            });
          }
        }}
      />
    );
  }

  if (appState.page === "order") {
    return (
      <>
        <div className="pointer-events-none select-none">
          <PaymentPage
            product={appState.product}
            session={session}
            savedCustomer={savedCustomer}
            isPending={false}
            onCancel={() => {}}
            onSubmit={() => {}}
          />
        </div>
        <OrderModal
          orderId={appState.orderId}
          initialPix={appState.initialPix}
          onClose={(paid) => {
            if (paid) {
              navigate("/");
            } else {
              // cancelado: volta para PaymentPage do mesmo produto
              buyMutation.reset();
              cardMutation.reset();
              window.history.pushState({}, "", "/");
              setAppState({ page: "payment", product: appState.product });
            }
          }}
        />
      </>
    );
  }

  return (
    <ProductsPage
      session={session}
      onSelectProduct={(product) => intentMutation.mutate(product.id)}
      intentLoading={intentMutation.isPending}
      intentError={intentMutation.isError}
    />
  );
}
