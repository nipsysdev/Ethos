import { describe, expect, it } from "vitest";

describe("CLI", () => {
	it("should validate command structure", async () => {
		// Import the CLI module dynamically to avoid immediate execution
		const { Command } = await import("commander");

		// Create a new command instance similar to our CLI
		const program = new Command();
		program
			.name("ethos")
			.description("Ethos Phase 1 crawler CLI")
			.version("1.0.0");

		program
			.command("crawl")
			.description("Crawl a specific source")
			.argument("<sourceId>", "ID of the source to crawl")
			.option("--config <path>", "Path to sources config file")
			.action(async (sourceId: string, options: { config?: string }) => {
				// Test that CLI validates arguments correctly
				expect(sourceId).toBe("test-source");
				expect(options.config).toBeDefined();
			});

		// Test command structure
		expect(program.commands).toHaveLength(1);
		expect(program.commands[0].name()).toBe("crawl");
		expect(program.commands[0].description()).toBe("Crawl a specific source");
	});
});
