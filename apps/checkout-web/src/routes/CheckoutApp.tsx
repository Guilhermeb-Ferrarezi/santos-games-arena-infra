import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  createOrder,
  getOrder,
  getSession,
  listProducts,
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
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-destructive">{message}</p>
    </div>
  );
}

function orderStatusBadge(status: Order["status"]) {
  if (status === "paid") return <Badge variant="success">Pago</Badge>;
  if (status === "pending") return <Badge variant="default">Aguardando pagamento</Badge>;
  if (status === "expired") return <Badge variant="muted">Expirado</Badge>;
  return <Badge variant="destructive">Falhou</Badge>;
}

function OrderStatusPage({ orderId }: { orderId: number }) {
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ? 3000 : false;
    }
  });

  if (isLoading) return <LoadingScreen />;
  if (error || !order) return <ErrorScreen message="Pedido não encontrado." />;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Status do pedido</CardTitle>
          <CardDescription>Pedido #{order.id}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Produto</span>
            <span className="text-sm font-medium">{order.description}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor</span>
            <span className="text-sm font-medium tabular-nums">
              {formatCurrency(order.amountCents)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {orderStatusBadge(order.status)}
          </div>
          {order.status === "pending" && order.checkoutUrl && (
            <p className="text-xs text-muted-foreground">
              Aguardando confirmação do pagamento…
            </p>
          )}
          {order.status === "paid" && (
            <p className="text-sm text-success font-medium">
              Pagamento confirmado! Obrigado pela compra.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.history.pushState({}, "", "/")}
          >
            Ver outros planos
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ProductCard({ product, onBuy }: { product: Product; onBuy: (id: number) => void }) {
  return (
    <Card className="flex flex-col transition-all hover:border-white/10">
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-3xl font-display font-bold text-primary">
          {formatCurrency(product.amountCents)}
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" size="lg" onClick={() => onBuy(product.id)}>
          Comprar
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProductsPage({ userLogin }: { userLogin: string }) {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts
  });

  const buyMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["order", result.orderId] });
      window.location.href = result.checkoutUrl;
    }
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Erro ao carregar produtos." />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/40 bg-surface-1">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-display font-bold tracking-tight">Santos Games</h1>
          <span className="text-sm text-muted-foreground">{userLogin}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
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
                onBuy={(id) => buyMutation.mutate(id)}
              />
            ))}
          </div>
        )}

        {buyMutation.isPending && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Criando pedido…</p>
            </div>
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

  useEffect(() => {
    const match = window.location.pathname.match(/^\/order\/(\d+)$/);
    if (match) {
      setOrderIdFromPath(parseInt(match[1], 10));
    }

    const onPopState = () => {
      const m = window.location.pathname.match(/^\/order\/(\d+)$/);
      setOrderIdFromPath(m ? parseInt(m[1], 10) : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
    return <OrderStatusPage orderId={orderIdFromPath} />;
  }

  return <ProductsPage userLogin={session.user.login} />;
}
