import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: resolve(__dirname, "src/cli/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    minify: false,
    rollupOptions: {
      external: [
        "node:module",
        "node:path",
        "node:fs",
        "node:os",
        "node:process",
        "node:stream",
        "node:util",
        "node:events",
        "node:child_process",
        "puppeteer",
        "puppeteer-extra",
        "puppeteer-extra-plugin-adblocker",
        "puppeteer-extra-plugin-stealth",
        "inquirer",
        "commander",
      ],
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
