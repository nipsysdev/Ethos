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
				"node:path",
				"node:fs",
				"node:fs/promises",
				"node:os",
				"node:stream",
				"node:child_process",
				"node:crypto",
				"node:url",
				"puppeteer",
				"puppeteer-extra",
				"puppeteer-extra-plugin-adblocker",
				"puppeteer-extra-plugin-stealth",
				"inquirer",
				"commander",
				"better-sqlite3",
				"express",
				"path",
				"fs",
				"vm",
				"events",
				"https",
				"http",
				"net",
				"os",
				"url",
				"tls",
				"crypto",
				"zlib",
				"stream",
				"util",
				"url",
				"assert",
				"child_process",
				"jsdom",
			],
			output: {
				entryFileNames: "ethos.js",
				banner: "#!/usr/bin/env node",
				inlineDynamicImports: true,
			},
		},
	},
});
