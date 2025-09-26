import express from "express";
import { errorHandler, notFoundHandler } from "@/server/middleware/error.js";
import {
	getPublicationByHashHandler,
	getPublicationsHandler,
} from "@/server/routes/api/publications.js";
import { getSourcesHandler } from "@/server/routes/api/sources.js";
import { getDetailViewHandler } from "@/server/routes/detail-handler.js";
import { getListingViewHandler } from "@/server/routes/listing-handler.js";
import type { ServerConfig } from "@/server/types.js";
import type { ContentStore } from "@/storage/ContentStore.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

export function createServer(
	metadataStore: MetadataStore,
	contentStore: ContentStore,
	_config: ServerConfig,
): express.Express {
	const app = express();

	app.set("view engine", "pug");
	app.use(express.json());

	app.get("/api/health", (_req, res) => {
		res.json({ status: "ok", timestamp: new Date().toISOString() });
	});

	app.get("/api/sources", getSourcesHandler());

	app.get(
		"/api/publications",
		getPublicationsHandler(metadataStore, contentStore),
	);
	app.get(
		"/api/publications/:hash",
		getPublicationByHashHandler(metadataStore, contentStore),
	);

	app.get("/", getListingViewHandler(metadataStore, contentStore));
	app.get("/:hash", getDetailViewHandler(metadataStore, contentStore));

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
			console.log(
				`Ethos API running at http://${config.host}:${config.port}/api/publications`,
			);
			console.log(
				`Ethos site running at http://${config.host}:${config.port}/`,
			);
			resolve(server);
		});

		server.on("error", (error) => {
			reject(error);
		});
	});
}
