import { join } from "node:path";
import { Command } from "commander";
import { CrawlerRegistry } from "./core/CrawlerRegistry.js";
import { ProcessingPipeline } from "./core/ProcessingPipeline.js";
import { SourceRegistry } from "./core/SourceRegistry.js";
import { ArticleListingCrawler } from "./crawlers/ArticleListingCrawler.js";
import { showMainMenu } from "./ui/menus.js";

const program = new Command();

const sourceRegistry = new SourceRegistry(
	join(process.cwd(), "src", "config", "sources.yaml"),
);
const crawlerRegistry = new CrawlerRegistry();
const pipeline = new ProcessingPipeline(crawlerRegistry, "./storage");

crawlerRegistry.register(new ArticleListingCrawler());

program
	.name("ethos")
	.description("Ethos web crawling command line interface")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu(sourceRegistry, pipeline);
	});

program.parseAsync(process.argv).catch(console.error);
