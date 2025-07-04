import { Command } from "commander";
import { crawlUrl } from "../crawlers/baseCrawler";

const program = new Command();

program
  .name("ethos-crawler")
  .description("CLI for Ethos crawling library")
  .version("1.0.0");

program
  .command("crawl <url>")
  .description("Crawl content from a URL")
  .action(async (url: string) => {
    try {
      console.log(`Starting crawl of ${url}...`);
      const result = await crawlUrl(url);
      console.log("Crawl completed successfully!");
      console.log(`Title: ${result.title}`);
      console.log(`Content length: ${result.content.length} characters`);
      console.log(`Timestamp: ${result.timestamp.toISOString()}`);
    } catch (error) {
      console.error("Crawl failed:", error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(console.error);
