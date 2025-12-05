import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dns from "dns";
dns.setDefaultResultOrder("verbatim");
// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
import vuetify from "vite-plugin-vuetify";

export default () => {
  const baseURL =
    process.env.APP_ENV === "development" ? "/" : "/recipe-frontend/";

  return defineConfig({
    plugins: [vue(), vuetify({ autoImport: true })],
    
    server: {
      host: "localhost",
      port: 8081,
      proxy: {
        // Proxy API requests to backend to avoid CORS issues
        "/booklistapi": {
          target: "http://localhost:3201",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path, // Keep the /booklistapi prefix
        },
      },
    },
    base: baseURL,
  });
};
