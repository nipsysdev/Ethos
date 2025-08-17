import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	build: {
		target: "node18",
		minify: false,
		rollupOptions: {
			input: resolve(__dirname, "src/index.ts"),
			external: [
				"node:module",
				"node:path",
				"node:fs",
				"node:fs/promises",
				"node:os",
				"node:process",
				"node:stream",
				"node:util",
				"node:events",
				"node:child_process",
				"node:crypto",
				"puppeteer",
				"puppeteer-extra",
				"puppeteer-extra-plugin-adblocker",
				"puppeteer-extra-plugin-stealth",
				"inquirer",
				"commander",
				"better-sqlite3",
			],
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name].js",
				assetFileNames: "[name].[ext]",
				banner: "#!/usr/bin/env node",
			},
		},
	},
});
