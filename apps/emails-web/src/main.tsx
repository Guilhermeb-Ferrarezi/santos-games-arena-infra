import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./routes/app";
// sem TanStack Router — roteamento manual via popstate
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
