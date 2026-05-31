import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const rootEnvDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, "");
  const apiUrl = env.VITE_EMAIL_API_URL || "http://localhost:3005";
  const authUrl = env.VITE_AUTH_API_URL || "https://auth.santos-games.com";

  return {
    base: "/",
    envDir: rootEnvDir,
    plugins: [tailwindcss(), react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: { outDir: "dist", emptyOutDir: true },
    server: {
      port: 5174,
      proxy: {
        "/api": { target: apiUrl, changeOrigin: true },
        "/__auth": { target: authUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/__auth/, "") },
      },
    },
  };
});
