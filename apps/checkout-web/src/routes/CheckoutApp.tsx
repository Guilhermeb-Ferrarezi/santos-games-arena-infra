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
  type Product
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

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function SgHeader({ userLogin }: { userLogin?: string }) {
  return (
    <header className="border-b border-border/40 bg-surface-1">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            className="h-9 w-9 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <span className="text-xl font-display font-bold tracking-wide text-foreground">
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

function PixCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (remaining === 0) {
    return (
      <span className="inline-flex items-center border px-2 py-0.5 text-xs font-semibold text-destructive border-destructive/40 bg-destructive/10">
        PIX expirado
      </span>
    );
  }

  const badgeClass =
    remaining > 120
      ? "text-success border-success/40 bg-success/10"
      : remaining > 60
        ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
        : "text-destructive border-destructive/40 bg-destructive/10";

  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClass}`}>
      Expira em {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

// ── Tela: form de dados do cliente ────────────────────────────────────────────

function CustomerFormPage({
  product,
  userLogin,
  onConfirm,
  onCancel
}: {
  product: Product;
  userLogin: string;
  onConfirm: (taxId: string, cellphone: string) => void;
  onCancel: () => void;
}) {
  const [taxId, setTaxId] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [error, setError] = useState("");

  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rawCpf = taxId.replace(/\D/g, "");
    const rawPhone = cellphone.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      setError("CPF inválido.");
      return;
    }
    if (rawPhone.length < 10) {
      setError("Telefone inválido.");
      return;
    }
    onConfirm(rawCpf, rawPhone);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader userLogin={userLogin} />

      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="mb-6 text-center">
          <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-primary mb-2">
            Dados para pagamento
          </span>
          <h2 className="text-2xl font-display font-bold">{product.name}</h2>
          <p className="mt-1 text-3xl font-display font-bold text-primary">
            {formatCurrency(product.amountCents)}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border/60 bg-surface-1 p-5 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              CPF
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={taxId}
              onChange={(e) => {
                setError("");
                setTaxId(formatCpf(e.target.value));
              }}
              className="w-full bg-surface-2 border border-border/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Telefone
            </label>
            <input
              type="text"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={cellphone}
              onChange={(e) => {
                setError("");
                setCellphone(formatPhone(e.target.value));
              }}
              className="w-full bg-surface-2 border border-border/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg">
            Gerar PIX
          </Button>
        </form>

        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </main>
    </div>
  );
}

// ── Tela: pagamento PIX ───────────────────────────────────────────────────────

function PixPaymentPage({
  order,
  pixCode,
  pixCodeBase64,
  pixExpiresAt,
  onBack
}: {
  order: Order;
  pixCode: string;
  pixCodeBase64: string;
  pixExpiresAt: string;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    });
  }

  if (order.status === "paid") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SgHeader />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-4xl">
              ✓
            </div>
            <h2 className="text-3xl font-display font-bold text-success">Pagamento confirmado!</h2>
            <p className="text-muted-foreground">{order.description}</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(order.amountCents)}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
              Ver outros planos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === "expired" || order.status === "failed") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SgHeader />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground">PIX expirado ou inválido.</p>
            <Button onClick={() => navigate("/")}>Criar novo pedido</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader />

      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="mb-6 text-center">
          <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-primary mb-2">
            Pagamento via PIX
          </span>
          <h2 className="text-2xl font-display font-bold">{order.description}</h2>
          <p className="mt-1 text-3xl font-display font-bold text-primary">
            {formatCurrency(order.amountCents)}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-surface-1 overflow-hidden">
          <div className="flex justify-center bg-white p-6">
            <img src={pixCodeBase64} alt="QR Code PIX" className="h-52 w-52" />
          </div>

          <div className="p-5 flex flex-col gap-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pedido #{order.id}</span>
              <PixCountdown expiresAt={pixExpiresAt} />
            </div>

            <Button className="w-full transition-all" onClick={handleCopy}>
              {copied ? "✓ Copiado!" : "Copiar código PIX"}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 bg-success animate-pulse"
                style={{ borderRadius: "50%" }}
              />
              Aguardando confirmação do pagamento…
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          Cancelar e voltar aos planos
        </Button>
      </main>
    </div>
  );
}

// ── Tela: status do pedido ────────────────────────────────────────────────────

function OrderStatusPage({
  orderId,
  initialPix,
  onBack
}: {
  orderId: number;
  initialPix?: CreateOrderResult;
  onBack: () => void;
}) {
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ? 3000 : false;
    },
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

  if (!order) return <LoadingScreen />;

  if (
    order.status === "pending" &&
    order.pixCode &&
    order.pixCodeBase64 &&
    order.pixExpiresAt
  ) {
    return (
      <PixPaymentPage
        order={order}
        pixCode={order.pixCode}
        pixCodeBase64={order.pixCodeBase64}
        pixExpiresAt={order.pixExpiresAt}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SgHeader />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          {order.status === "paid" && (
            <>
              <p className="text-3xl font-display font-bold text-success">Pagamento confirmado!</p>
              <Button variant="outline" onClick={() => navigate("/")}>Ver outros planos</Button>
            </>
          )}
          {(order.status === "pending" || order.status === "expired" || order.status === "failed") && (
            <>
              <p className="text-muted-foreground">PIX expirado. Crie um novo pedido.</p>
              <Button onClick={() => navigate("/")}>Voltar aos planos</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tela: lista de produtos ───────────────────────────────────────────────────

function ProductCard({
  product,
  onBuy
}: {
  product: Product;
  onBuy: (id: number) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border/60 bg-surface-1 overflow-hidden transition-all hover:border-primary/40">
      <div className="flex-1 p-6">
        <h3 className="text-xl font-display font-bold mb-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
        <p className="text-3xl font-display font-bold text-primary">
          {formatCurrency(product.amountCents)}
        </p>
      </div>
      <div className="px-6 pb-6">
        <Button className="w-full" size="lg" onClick={() => onBuy(product.id)}>
          Comprar agora
        </Button>
      </div>
    </div>
  );
}

function ProductsPage({
  userLogin,
  onSelectProduct
}: {
  userLogin: string;
  onSelectProduct: (product: Product) => void;
}) {
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts
  });

  if (isLoading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SgHeader userLogin={userLogin} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-destructive">Erro ao carregar produtos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SgHeader userLogin={userLogin} />

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
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

type AppState =
  | { page: "products" }
  | { page: "customer-form"; product: Product }
  | { page: "order"; orderId: number; initialPix?: CreateOrderResult };

export function CheckoutApp() {
  const queryClient = useQueryClient();

  const [appState, setAppState] = useState<AppState>({ page: "products" });

  // Sync URL → state
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
    mutationFn: ({
      productId,
      customer
    }: {
      productId: number;
      customer: { taxId: string; cellphone: string };
    }) => createOrder(productId, customer),
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

  const { login: userLogin } = session.user;

  if (appState.page === "customer-form") {
    return (
      <CustomerFormPage
        product={appState.product}
        userLogin={userLogin}
        onCancel={() => setAppState({ page: "products" })}
        onConfirm={(taxId, cellphone) => {
          buyMutation.mutate({ productId: appState.product.id, customer: { taxId, cellphone } });
        }}
      />
    );
  }

  if (appState.page === "order") {
    return (
      <OrderStatusPage
        orderId={appState.orderId}
        initialPix={appState.initialPix}
        onBack={() => {
          navigate("/");
        }}
      />
    );
  }

  return (
    <ProductsPage
      userLogin={userLogin}
      onSelectProduct={(product) => setAppState({ page: "customer-form", product })}
    />
  );
}
