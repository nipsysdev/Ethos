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
				"node:fs/promises",
				"node:crypto",
				"node:events",
				"node:child_process",
				"node:fs",
				"node:process",
				"fs",
				"os",
				"path",
				"node:stream",
				"stream",
				"http",
				"url",
				"https",
				"zlib",
				"node:os",
				"node:tty",
				"node:readline",
				"child_process",
				"node:http",
				"node:net",
				"node:assert",
				"async_hooks",
				"querystring",
				"util",
				"readline",
				"tty",
				"node:zlib",
				"crypto",
				"events",
				"assert",
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
