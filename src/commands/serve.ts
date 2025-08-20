import { createServer, startServer } from "@/server/index";
import type { ServerConfig } from "@/server/types";
import { createContentStore } from "@/storage/ContentStore";
import { getStoragePath } from "@/utils/storagePath.js";

export async function serveApi(
	port = "3000",
	host = "localhost",
): Promise<void> {
	const config: ServerConfig = {
		port: parseInt(port, 10),
		host,
		pagination: {
			defaultLimit: 10,
			maxLimit: 100,
		},
	};

	try {
		const contentStore = createContentStore(getStoragePath());
		const metadataStore = contentStore.getMetadataStore();

		if (!metadataStore) {
			console.error("Metadata store not available");
			process.exit(1);
		}

		const app = createServer(metadataStore, contentStore, config);
		const server = await startServer(app, config);

		process.on("SIGTERM", () => {
			console.log("Received SIGTERM, shutting down gracefully...");
			server.close(() => {
				console.log("Server closed");
				contentStore.close();
				process.exit(0);
			});
		});

		process.on("SIGINT", () => {
			console.log("Received SIGINT, shutting down gracefully...");
			server.close(() => {
				console.log("Server closed");
				contentStore.close();
				process.exit(0);
			});
		});
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}
