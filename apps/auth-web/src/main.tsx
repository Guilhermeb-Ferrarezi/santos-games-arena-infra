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
const makeRoute = (path: string) => createRoute({ getParentRoute: () => rootRoute, path, component: () => <AuthApp /> });
const router = createRouter({
  routeTree: rootRoute.addChildren([
    makeRoute("/"),
    makeRoute("/register"),
    makeRoute("/set-password"),
    makeRoute("/2fa"),
    makeRoute("/forgot-password"),
    makeRoute("/reset-password"),
  ])
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
