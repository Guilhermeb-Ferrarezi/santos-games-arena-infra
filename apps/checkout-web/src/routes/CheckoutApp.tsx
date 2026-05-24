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
            alt="Santos Games"
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
    return <span className="inline-flex items-center border px-2 py-0.5 text-xs font-semibold text-destructive border-destructive/40 bg-destructive/10">PIX expirado</span>;
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

function PixPaymentPage({
  order,
  pixCode,
  pixCodeBase64,
  pixExpiresAt
}: {
  order: Order;
  pixCode: string;
  pixCodeBase64: string;
  pixExpiresAt: string;
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
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.history.pushState({}, "", "/")}
            >
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
            <Button onClick={() => window.history.pushState({}, "", "/")}>
              Criar novo pedido
            </Button>
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
          <div className="flex justify-center bg-white p-6 shadow-inner">
            <img
              src={pixCodeBase64}
              alt="QR Code PIX"
              className="h-52 w-52"
            />
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
              <span className="inline-block h-1.5 w-1.5 bg-success animate-pulse" style={{ borderRadius: "50%" }} />
              Aguardando confirmação do pagamento…
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground hover:text-foreground"
          onClick={() => window.history.pushState({}, "", "/")}
        >
          Voltar aos planos
        </Button>
      </main>
    </div>
  );
}

function OrderStatusPage({ orderId, initialPix }: { orderId: number; initialPix?: CreateOrderResult }) {
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

  const pixCode = order.pixCode;
  const pixCodeBase64 = order.pixCodeBase64;
  const pixExpiresAt = order.pixExpiresAt;

  if (order.status === "pending" && pixCode && pixCodeBase64 && pixExpiresAt) {
    return (
      <PixPaymentPage
        order={order}
        pixCode={pixCode}
        pixCodeBase64={pixCodeBase64}
        pixExpiresAt={pixExpiresAt}
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
              <Button variant="outline" onClick={() => window.history.pushState({}, "", "/")}>
                Ver outros planos
              </Button>
            </>
          )}
          {order.status === "pending" && (
            <p className="text-muted-foreground">PIX expirado. Crie um novo pedido.</p>
          )}
          {(order.status === "expired" || order.status === "failed") && (
            <p className="text-muted-foreground">Pedido expirado ou inválido.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, onBuy, loading }: { product: Product; onBuy: (id: number) => void; loading: boolean }) {
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
        <Button
          className="w-full"
          size="lg"
          onClick={() => onBuy(product.id)}
          disabled={loading}
        >
          {loading ? "Processando…" : "Comprar agora"}
        </Button>
      </div>
    </div>
  );
}

function ProductsPage({ userLogin }: { userLogin: string }) {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts
  });

  const [pendingProductId, setPendingProductId] = useState<number | null>(null);

  const buyMutation = useMutation({
    mutationFn: createOrder,
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
      window.history.pushState({ pix: result }, "", `/order/${result.orderId}`);
      window.dispatchEvent(new PopStateEvent("popstate", { state: { pix: result } }));
    },
    onSettled: () => setPendingProductId(null)
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
          <p className="mt-2 text-muted-foreground">
            Pague via PIX e tenha acesso imediato.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Nenhum produto disponível no momento.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                loading={pendingProductId === p.id && buyMutation.isPending}
                onBuy={(id) => {
                  setPendingProductId(id);
                  buyMutation.mutate(id);
                }}
              />
            ))}
          </div>
        )}

        {buyMutation.isError && (
          <p className="mt-4 text-center text-sm text-destructive">
            Erro ao processar pedido. Tente novamente.
          </p>
        )}
      </main>
    </div>
  );
}

export function CheckoutApp() {
  const [orderIdFromPath, setOrderIdFromPath] = useState<number | null>(null);
  const [initialPix, setInitialPix] = useState<CreateOrderResult | undefined>(undefined);

  useEffect(() => {
    function handlePath() {
      const match = window.location.pathname.match(/^\/order\/(\d+)$/);
      if (match) {
        const id = parseInt(match[1], 10);
        setOrderIdFromPath(id);
        const state = window.history.state as { pix?: CreateOrderResult } | null;
        setInitialPix(state?.pix);
      } else {
        setOrderIdFromPath(null);
        setInitialPix(undefined);
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

  if (isLoading) return <LoadingScreen />;

  if (!session?.authenticated || !session.user) {
    redirectToLogin();
    return <LoadingScreen />;
  }

  if (orderIdFromPath !== null) {
    return <OrderStatusPage orderId={orderIdFromPath} initialPix={initialPix} />;
  }

  return <ProductsPage userLogin={session.user.login} />;
}
