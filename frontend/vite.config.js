import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    historyApiFallback: true, // 🔁 važno za SPA routing
  	watch: {
	    usePolling: true
 	},
  },
});