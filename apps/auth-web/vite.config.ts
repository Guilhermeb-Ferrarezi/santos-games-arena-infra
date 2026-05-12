import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const rootEnvDir = fileURLToPath(new URL("../..", import.meta.url));
const rootPublicDir = fileURLToPath(new URL("../../public", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, "");
  const authApiUrl = env.VITE_AUTH_API_URL || env.AUTH_PUBLIC_URL || "http://localhost:3001";

  return {
    publicDir: rootPublicDir,
    envDir: rootEnvDir,
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api/auth": {
          target: authApiUrl,
          changeOrigin: true
        },
        "/api/health": {
          target: authApiUrl,
          changeOrigin: true
        }
      }
    }
  };
});
