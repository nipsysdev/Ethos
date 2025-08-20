import express from "express";
import type { ContentStore } from "@/storage/ContentStore.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import {
	getContentByHashHandler,
	getContentHandler,
} from "./routes/content.js";
import type { ServerConfig } from "./types.js";

export function createServer(
	metadataStore: MetadataStore,
	contentStore: ContentStore,
	_config: ServerConfig,
): express.Express {
	const app = express();

	app.use(express.json());

	app.get("/health", (_req, res) => {
		res.json({ status: "ok", timestamp: new Date().toISOString() });
	});

	app.get("/content", getContentHandler(metadataStore, contentStore));
	app.get(
		"/content/:hash",
		getContentByHashHandler(metadataStore, contentStore),
	);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}

export function startServer(
	app: express.Express,
	config: ServerConfig,
): Promise<import("http").Server> {
	return new Promise((resolve, reject) => {
		const server = app.listen(config.port, config.host, () => {
			console.log(`Ethos API running at http://${config.host}:${config.port}`);
			resolve(server);
		});

		server.on("error", (error) => {
			reject(error);
		});
	});
}
