import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
	ArticleListingCrawler,
	CrawlerRegistry,
	ProcessingPipeline,
	SourceRegistry,
} from "@/index.js";
import { showMainMenu } from "./menu.js";

// Global tracking of temp metadata files for cleanup
const activeTempFiles = new Set<string>();

export function registerTempFile(filePath: string): void {
	activeTempFiles.add(filePath);
}

export function unregisterTempFile(filePath: string): void {
	activeTempFiles.delete(filePath);
}

function cleanupAllTempFiles(): void {
	for (const filePath of activeTempFiles) {
		try {
			unlinkSync(filePath);
		} catch {
			// Ignore cleanup errors
		}
	}
	activeTempFiles.clear();
}

// Register cleanup handlers for process exit
process.on("exit", cleanupAllTempFiles);
process.on("SIGINT", () => {
	cleanupAllTempFiles();
	process.exit(0);
});
process.on("SIGTERM", () => {
	cleanupAllTempFiles();
	process.exit(0);
});
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	cleanupAllTempFiles();
	process.exit(1);
});

const program = new Command();

// Initialize the system
const sourceRegistry = new SourceRegistry(
	join(process.cwd(), "src", "config", "sources.yaml"),
);
const crawlerRegistry = new CrawlerRegistry();
const pipeline = new ProcessingPipeline(crawlerRegistry, "./storage");

// Register crawlers
crawlerRegistry.register(new ArticleListingCrawler());

program
	.name("ethos-crawler")
	.description("CLI for Ethos crawling library")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu(sourceRegistry, pipeline);
	});

program.parseAsync(process.argv).catch(console.error);
