import { join } from "node:path";
import { Command } from "commander";
import {
	ArticleListingCrawler,
	CrawlerRegistry,
	ProcessingPipeline,
	SourceRegistry,
} from "@/index.js";
import { showMainMenu } from "./menu.js";

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
