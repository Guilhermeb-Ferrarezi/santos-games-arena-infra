import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { CheckoutApp } from "@/routes/CheckoutApp";
import "@/styles.css";

const queryClient = new QueryClient();

const rootRoute = createRootRoute({ component: CheckoutApp });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: "/order/$orderId" });

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, orderRoute])
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
