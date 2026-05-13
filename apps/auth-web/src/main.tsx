import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { AuthApp } from "@/routes/AuthApp";
import "@/styles.css";

const queryClient = new QueryClient();
const rootRoute = createRootRoute({
  component: () => <AuthApp />
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <AuthApp />
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: () => <AuthApp />
});
const setPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/set-password",
  component: () => <AuthApp />
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, registerRoute, setPasswordRoute])
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
