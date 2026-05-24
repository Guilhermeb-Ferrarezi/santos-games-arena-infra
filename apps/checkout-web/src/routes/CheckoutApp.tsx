import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelOrder,
  createOrder,
  createPayIntent,
  getCustomerInfo,
  getOrder,
  getPayIntent,
  getSession,
  listProducts,
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

function SgHeader({
  userLogin,
  onBack
}: {
  userLogin?: string;
  onBack?: () => void;
}) {
  const [logoErr, setLogoErr] = useState(false);
  return (
    <header className="border-b border-border/40 bg-surface-1">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon />
            </button>
          )}
          {!logoErr && (
            <img
              src="/logo.png"
              alt=""
              className="h-8 w-8 object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
              onError={() => setLogoErr(true)}
            />
          )}
          <span className="font-display font-bold text-lg tracking-wider text-foreground">
            SANTOS GAMES
          </span>
        </div>
        {userLogin && (
          <span className="text-sm text-muted-foreground">{userLogin}</span>
        )}
      </div>
    </header>
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
  onClose: () => void;
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
    onClose();
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
          <Button className="mt-2 w-full" onClick={onClose}>Ver outros planos</Button>
        </div>
      </div>
    );
  }

  if (order.status === "expired" || order.status === "failed" || order.status === "cancelled") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-sm border border-border/60 bg-surface-1 p-8 text-center flex flex-col items-center gap-4">
          <p className="text-destructive font-semibold">PIX expirado ou inválido.</p>
          <Button onClick={onClose}>Criar novo pedido</Button>
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
  onClose: () => void;
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
        onClose={onClose}
      />
    );
  }

  return (
    <PixModal
      order={order}
      pixCode=""
      pixCodeBase64=""
      pixExpiresAt={new Date(Date.now() + 1000).toISOString()}
      onClose={onClose}
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
  onSubmit: (data: { name: string; email: string; taxId: string; cellphone: string }) => void;
  isPending: boolean;
  mutationError?: string;
}) {
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

  type FieldErrors = { name?: string; email?: string; taxId?: string; cellphone?: string };
  const [errors, setErrors] = useState<FieldErrors>({});
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

  function handleChange<T>(setter: (v: T) => void, field: keyof FieldErrors) {
    return (v: T) => {
      setter(v);
      if (submitted) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleBlur(field: keyof FieldErrors) {
    if (!submitted) {
      const vals = { name, email, taxId, cellphone };
      const e = validate(vals);
      if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
    }
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    const vals = { name, email, taxId, cellphone };
    const e = validate(vals);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit({
      name: vals.name.trim(),
      email: vals.email.trim(),
      taxId: vals.taxId.replace(/\D/g, ""),
      cellphone: vals.cellphone.replace(/\D/g, "")
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
          <div className="w-full min-w-0 max-w-sm">
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
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 border border-border/30 bg-surface-1 px-3 py-3 text-sm text-muted-foreground/40 cursor-not-allowed select-none"
              >
                <CreditCardIcon />
                <span>Cartão</span>
                <span className="border border-border/30 px-1 text-[9px] uppercase tracking-wide">Em breve</span>
              </button>
              <div className="flex items-center justify-center gap-2 border border-[#32BCAD]/60 bg-[#32BCAD]/10 px-3 py-3 text-sm font-semibold text-[#32BCAD]">
                <PixIcon />
                <span>PIX</span>
              </div>
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
                  onChange={(e) => handleChange(setName, "name")(e.target.value)}
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
                  onChange={(e) => handleChange(setEmail, "email")(e.target.value)}
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
                  onChange={(e) => handleChange(setTaxId, "taxId")(formatCpf(e.target.value))}
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
                  onChange={(e) => handleChange(setCellphone, "cellphone")(formatPhone(e.target.value))}
                  onBlur={() => handleBlur("cellphone")}
                  disabled={isPending}
                />
              </FormField>

              {mutationError && (
                <p className="text-xs text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2">
                  {mutationError}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full gap-2" disabled={isPending}>
                {isPending ? (
                  <>
                    <Spinner />
                    <span>Gerando PIX…</span>
                  </>
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
          <div className="flex-1 md:block">
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

              {/* Divisor */}
              <div className="border-t border-border/40" />

              {/* Preços */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(product.amountCents)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa (0%)</span>
                  <span>R$ 0,00</span>
                </div>
              </div>

              {/* Divisor */}
              <div className="border-t border-border/40" />

              {/* Total */}
              <div className="flex justify-between font-semibold">
                <span>Total hoje</span>
                <span className="text-primary text-lg font-display font-bold">
                  {formatCurrency(product.amountCents)}
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

function ProductCard({ product, onBuy }: { product: Product; onBuy: () => void }) {
  return (
    <div className="flex flex-col border border-border/60 bg-surface-1 overflow-hidden transition-all hover:border-primary/40">
      <div className="flex-1 p-6">
        <h3 className="text-xl font-display font-bold mb-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
        <p className="text-3xl font-display font-bold text-primary">
          {formatCurrency(product.amountCents)}
        </p>
      </div>
      <div className="border-t border-border/40 px-6 pb-6 pt-4">
        <Button className="w-full" size="lg" onClick={onBuy}>
          Comprar agora
        </Button>
      </div>
    </div>
  );
}

function ProductsPage({
  session,
  onSelectProduct
}: {
  session: Session;
  onSelectProduct: (product: Product) => void;
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
            <p className="mt-2 text-muted-foreground">Pague via PIX e tenha acesso imediato.</p>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum produto disponível no momento.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onBuy={() => onSelectProduct(p)} />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

type AppState =
  | { page: "products" }
  | { page: "intent"; token: string }
  | { page: "payment"; product: Product }
  | { page: "order"; orderId: number; product: Product; initialPix?: CreateOrderResult };

export function CheckoutApp() {
  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppState>({ page: "products" });

  useEffect(() => {
    function handlePath() {
      const orderMatch = window.location.pathname.match(/^\/order\/(\d+)$/);
      const intentMatch = window.location.pathname.match(/^\/pay\/([a-f0-9]+)$/);
      if (orderMatch) {
        const orderId = parseInt(orderMatch[1], 10);
        const state = window.history.state as { pix?: CreateOrderResult; product?: Product } | null;
        // se tem produto no history state (navegação normal), mantém a PaymentPage como fundo
        // se não tem (refresh direto na URL), volta para produtos
        setAppState(
          state?.product
            ? { page: "order", orderId, product: state.product, initialPix: state?.pix }
            : { page: "products" }
        );
      } else if (intentMatch) {
        setAppState({ page: "intent", token: intentMatch[1] });
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
    mutationFn: (vars: { productId: number; product: Product; customer: { name: string; email: string; taxId: string; cellphone: string } }) =>
      createOrder(vars.productId, vars.customer).then((r) => ({ ...r, product: vars.product })),
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
      window.history.pushState({ pix: result, product: result.product }, "", `/order/${result.orderId}`);
      // seta estado diretamente para garantir que o fundo é a PaymentPage
      setAppState({ page: "order", orderId: result.orderId, product: result.product, initialPix: result });
    }
  });

  if (isLoading) return <LoadingScreen />;

  if (!session?.authenticated || !session.user) {
    redirectToLogin();
    return <LoadingScreen />;
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
        isPending={buyMutation.isPending}
        mutationError={buyMutation.error ? "Erro ao gerar PIX. Tente novamente." : undefined}
        onCancel={() => navigate("/")}
        onSubmit={(customer) => {
          buyMutation.mutate({ productId: appState.product.id, product: appState.product, customer });
        }}
      />
    );
  }

  if (appState.page === "order") {
    return (
      <>
        <PaymentPage
          product={appState.product}
          session={session}
          savedCustomer={savedCustomer}
          isPending={false}
          onCancel={() => navigate("/")}
          onSubmit={() => {}}
        />
        <OrderModal
          orderId={appState.orderId}
          initialPix={appState.initialPix}
          onClose={() => navigate("/")}
        />
      </>
    );
  }

  return (
    <ProductsPage
      session={session}
      onSelectProduct={(product) => intentMutation.mutate(product.id)}
    />
  );
}
