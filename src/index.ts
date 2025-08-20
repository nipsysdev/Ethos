import { Command } from "commander";
import { crawlWithOptions } from "@/commands/crawl";
import { serveApi } from "@/commands/serve";
import { createCrawlerRegistry } from "@/core/CrawlerRegistry";
import { createProcessingPipeline } from "@/core/ProcessingPipeline";
import { createArticleListingCrawler } from "@/crawlers/ArticleListingCrawler";
import { showMainMenu } from "@/ui/menus";
import { NAV_VALUES } from "./ui/constants";
import { getStoragePath } from "./utils/storagePath.js";

const program = new Command();

const crawlerRegistry = createCrawlerRegistry();
const pipeline = createProcessingPipeline(crawlerRegistry, getStoragePath());

crawlerRegistry.register(createArticleListingCrawler());

program
	.name("ethos")
	.description("Ethos web crawling command line interface")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu(pipeline);
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
		const result = await crawlWithOptions(crawlOptions, pipeline);

		if (result === NAV_VALUES.EXIT) {
			process.exit(0);
		}
	});

program
	.command("serve")
	.description("Start the REST API server")
	.option("-p, --port <number>", "Port to run the server on", (val) =>
		parseInt(val, 10),
	)
	.option("-h, --host <string>", "Host to bind the server to")
	.action(async (options) => {
		if (options.port) {
			process.env.PORT = options.port.toString();
		}
		if (options.host) {
			process.env.HOST = options.host;
		}
		await serveApi();
	});

program.parseAsync(process.argv).catch(console.error);
