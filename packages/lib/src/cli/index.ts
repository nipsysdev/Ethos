import { Command } from "commander";

const program = new Command();

program
  .name("ethos-scraper")
  .description("CLI for Ethos scraping library")
  .version("1.0.0");

program
  .command("scrape <url>")
  .description("Scrape content from a URL")
  .action(async (url: string) => {
    console.log(`Scraping ${url}...`);
    // TODO: Implement scraping logic
  });

program.parseAsync(process.argv).catch(console.error);
