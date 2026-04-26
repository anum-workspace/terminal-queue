import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        react({
            fastRefresh: {
                overlay: false,
            },
        }),
    ],
    build: {
        // minify: false,
        outDir: "electron/dist",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                entryFileNames: "script.js",
                chunkFileNames: "chunks/[name].js",
                assetFileNames: "assets/[name].[ext]",
            },
        },
    },
    base: "./",
});
