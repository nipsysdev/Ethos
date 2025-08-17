import { join } from "node:path";
import { Command } from "commander";
import { crawlWithOptions } from "@/commands/crawl";
import { createCrawlerRegistry } from "@/core/CrawlerRegistry";
import { createProcessingPipeline } from "@/core/ProcessingPipeline";
import { createSourceRegistry } from "@/core/SourceRegistry";
import { createArticleListingCrawler } from "@/crawlers/ArticleListingCrawler";
import { showMainMenu } from "@/ui/menus";
import { NAV_VALUES } from "./ui/constants";

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

program
	.command("crawl")
	.description("Crawl a source for content")
	.argument("<source>", "Source ID to crawl")
	.option(
		"-m, --max-pages <number>",
		"Maximum number of pages to crawl",
		(val) => parseInt(val, 10),
	)
	.option(
		"--force-full-crawl",
		"Continue crawling when reached previous crawl session URLs",
	)
	.option("--recrawl", "Re-crawl and override existing URLs data")
	.option("-o, --output <format>", "Output format (json|summary)", "summary")
	.action(async (source, options) => {
		const crawlOptions = {
			source,
			maxPages: options.maxPages,
			stopOnAllDuplicates: !options.forceFullCrawl,
			reCrawlExisting: options.recrawl,
			output: options.output,
		};
		const result = await crawlWithOptions(
			crawlOptions,
			sourceRegistry,
			pipeline,
		);

		if (result === NAV_VALUES.EXIT) {
			process.exit(0);
		}
	});

program.parseAsync(process.argv).catch(console.error);
