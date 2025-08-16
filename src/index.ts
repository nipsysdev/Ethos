import { join } from "node:path";
import { Command } from "commander";
import { createCrawlerRegistry } from "@/core/CrawlerRegistry";
import { createProcessingPipeline } from "@/core/ProcessingPipeline";
import { createSourceRegistry } from "@/core/SourceRegistry";
import { createArticleListingCrawler } from "@/crawlers/ArticleListingCrawler";
import { showMainMenu } from "@/ui/menus";

const program = new Command();

const sourceRegistry = createSourceRegistry(
	join(process.cwd(), "src", "config", "sources.yaml"),
);
const crawlerRegistry = createCrawlerRegistry();
const pipeline = createProcessingPipeline(crawlerRegistry, "./storage");

crawlerRegistry.register(createArticleListingCrawler());

program
	.name("ethos")
	.description("Ethos web crawling command line interface")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu(sourceRegistry, pipeline);
	});

program.parseAsync(process.argv).catch(console.error);
