import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createOrder,
  getOrder,
  getSession,
  listProducts,
  type CreateOrderResult,
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
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor">
      <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.385 14.765-5.373 20.138 0l76.994 76.994c14.192 14.192 33.064 22 53.12 22h15.337l-97.11 97.109c-30.288 30.288-79.402 30.288-109.69 0L104.057 391.19h8.513zm286.856-271.395c-20.056 0-38.928 7.808-53.12 22L269.012 218.5c-5.397 5.397-14.741 5.385-20.138 0l-76.692-76.706c-14.192-14.192-33.064-22-53.12-22h-8.513l97.115-97.108c30.288-30.288 79.402-30.288 109.69 0l97.115 97.108h-15.04zM22.18 173.55l55.01-55.01c2.311 1.01 4.845 1.609 7.482 1.609h27.898c13.37 0 26.257 5.483 35.498 15.07l76.692 76.706c14.804 14.804 34.256 22.207 53.708 22.207 19.452 0 38.917-7.403 53.708-22.207l76.994-76.994c9.241-9.587 22.128-15.07 35.498-15.07h22.362c3.235 0 6.29-.754 9.014-2.09l55.655 55.655c30.288 30.288 30.288 79.402 0 109.69l-55.655 55.655c-2.724-1.336-5.779-2.09-9.014-2.09h-22.362c-13.37 0-26.257-5.483-35.498-15.07l-76.994-76.994c-14.791-14.804-34.256-22.207-53.708-22.207-19.452 0-38.904 7.403-53.708 22.207l-76.692 76.706c-9.241 9.587-22.128 15.07-35.498 15.07H84.672c-2.637 0-5.17.598-7.482 1.609L22.18 283.245c-30.288-30.288-30.288-79.402 0-109.69z" />
    </svg>
  );
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
  const copyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      if (copyRef.current) clearTimeout(copyRef.current);
      copyRef.current = setTimeout(() => setCopied(false), 2500);
    });
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

  if (order.status === "expired" || order.status === "failed") {
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

          <button
            onClick={onClose}
            className="w-full py-1.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
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
  onCancel,
  onSubmit,
  isPending,
  mutationError
}: {
  product: Product;
  session: Session;
  onCancel: () => void;
  onSubmit: (data: { name: string; email: string; taxId: string; cellphone: string }) => void;
  isPending: boolean;
  mutationError?: string;
}) {
  const [name, setName] = useState(session.user?.login ?? "");
  const [email, setEmail] = useState(session.user?.email ?? "");
  const [taxId, setTaxId] = useState("");
  const [cellphone, setCellphone] = useState("");

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

  function validate(vals: { name: string; email: string; taxId: string; cellphone: string }) {
    const e: FieldErrors = {};
    if (vals.name.trim().length < 3) e.name = "Informe seu nome completo.";
    if (!/\S+@\S+\.\S+/.test(vals.email.trim())) e.email = "E-mail inválido.";
    if (vals.taxId.replace(/\D/g, "").length !== 11) e.taxId = "CPF inválido.";
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader userLogin={session.user?.login} onBack={onCancel} />

      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Product info */}
          <div className="mb-6 text-center">
            <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
              DADOS PARA PAGAMENTO
            </span>
            <h2 className="mt-3 text-2xl font-display font-bold">{product.name}</h2>
            <p className="mt-1 text-4xl font-display font-bold text-primary">
              {formatCurrency(product.amountCents)}
            </p>
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
      </main>
    </div>
  );
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
  | { page: "payment"; product: Product }
  | { page: "order"; orderId: number; initialPix?: CreateOrderResult };

export function CheckoutApp() {
  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppState>({ page: "products" });

  useEffect(() => {
    function handlePath() {
      const match = window.location.pathname.match(/^\/order\/(\d+)$/);
      if (match) {
        const orderId = parseInt(match[1], 10);
        const state = window.history.state as { pix?: CreateOrderResult } | null;
        setAppState({ page: "order", orderId, initialPix: state?.pix });
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

  const buyMutation = useMutation({
    mutationFn: (vars: { productId: number; customer: { name: string; email: string; taxId: string; cellphone: string } }) =>
      createOrder(vars.productId, vars.customer),
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
      navigate(`/order/${result.orderId}`, { pix: result });
    }
  });

  if (isLoading) return <LoadingScreen />;

  if (!session?.authenticated || !session.user) {
    redirectToLogin();
    return <LoadingScreen />;
  }

  if (appState.page === "payment") {
    return (
      <PaymentPage
        product={appState.product}
        session={session}
        isPending={buyMutation.isPending}
        mutationError={buyMutation.error ? "Erro ao gerar PIX. Tente novamente." : undefined}
        onCancel={() => setAppState({ page: "products" })}
        onSubmit={(customer) => {
          buyMutation.mutate({ productId: appState.product.id, customer });
        }}
      />
    );
  }

  if (appState.page === "order") {
    return (
      <>
        <ProductsPage
          session={session}
          onSelectProduct={(product) => setAppState({ page: "payment", product })}
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
      onSelectProduct={(product) => setAppState({ page: "payment", product })}
    />
  );
}
