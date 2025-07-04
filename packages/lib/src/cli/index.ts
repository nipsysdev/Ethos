import { Command } from "commander";
import { crawlUrl } from "../crawlers/baseCrawler";
const inquirer = (await import("inquirer")).default;

const program = new Command();

const SOURCES = [
  "https://monitor.civicus.org/",
  "https://acleddata.com/",
  "https://www.gdeltproject.org/data.html#rawdatafiles",
  "https://netblocks.org/",
  "https://ooni.org/",
  "https://www.crisisgroup.org/crisiswatch",
  "https://carnegieendowment.org/features/global-protest-tracker?lang=en",
  "https://protectdefenders.eu/index-of-alerts/",
  "https://freedomhouse.org/",
  "https://www.accessnow.org/campaign/keepiton/?tztc=1",
];

const COMMANDS = [
  { name: "crawl", description: "Start crawling a source" },
  { name: "analyze", description: "Analyze crawled data" },
  { name: "run", description: "Run continuous crawling" },
  { name: "config", description: "Manage configuration" },
  { name: "exit", description: "Exit the program" },
];

async function showMainMenu() {
  while (true) {
    const { command } = await inquirer.prompt([
      {
        type: "list",
        name: "command",
        message: "Select a command:",
        choices: COMMANDS.map((cmd) => ({
          name: `${cmd.name} - ${cmd.description}`,
          value: cmd.name,
        })),
      },
    ]);

    if (command === "exit") {
      console.log("Goodbye!");
      process.exit(0);
    }

    await handleCommand(command);
  }
}

async function handleCommand(command: string) {
  switch (command) {
    case "crawl":
      await handleCrawl();
      break;
    case "analyze":
    case "run":
    case "config":
      console.log(`${command} command is not yet implemented`);
      break;
    default:
      console.log("Unknown command");
  }
}

async function handleCrawl() {
  try {
    const { selectedSource } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedSource",
        message: "Select a source to crawl:",
        choices: SOURCES,
      },
    ]);

    console.log(`Starting crawl of ${selectedSource}...`);
    const result = await crawlUrl(selectedSource);
    console.log("Crawl completed successfully!");
    console.log(`Title: ${result.title}`);
    console.log(`Content length: ${result.content.length} characters`);
    console.log(`Timestamp: ${result.timestamp.toISOString()}`);
  } catch (error) {
    console.error("Crawl failed:", error);
  }
}

program
  .name("ethos-crawler")
  .description("CLI for Ethos crawling library")
  .version("1.0.0")
  .command("crawl")
  .description("Start crawling a source")
  .action(async () => {
    await handleCrawl();
  });

program.action(async () => {
  await showMainMenu();
});

program.parseAsync(process.argv).catch(console.error);
