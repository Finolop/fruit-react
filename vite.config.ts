import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget =
    env.REACT_APP_API_URL || env.VITE_API_URL || "http://localhost:8000";

  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          exportType: "named",
          ref: true,
          svgo: false,
          titleProp: true,
        },
        include: "**/*.svg",
      }),
    ],
    server: {
      port: 3000,
      host: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/static": {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "build",
    },
    define: {
      "process.env.REACT_APP_API_URL": JSON.stringify(
        env.REACT_APP_API_URL || env.VITE_API_URL || "",
      ),
    },
  };
});