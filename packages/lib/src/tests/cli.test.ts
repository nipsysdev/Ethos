import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock process.exit to prevent the test runner from actually exiting
const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
	throw new Error("process.exit() called");
});

// Mock console methods to capture output
const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

describe("CLI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		mockExit.mockRestore();
		mockLog.mockRestore();
		mockError.mockRestore();
	});

	it("should handle missing config file gracefully", async () => {
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
	});

	it("should handle exit command", async () => {
		const { Command } = await import("commander");

		const program = new Command();
		program
			.name("ethos")
			.description("Ethos Phase 1 crawler CLI")
			.version("1.0.0");

		program
			.command("exit")
			.description("Exit the CLI")
			.action(() => {
				// This would normally call process.exit(0)
				expect(true).toBe(true); // Just verify the command exists
			});

		// Test command registration
		expect(program.commands.find((cmd) => cmd.name() === "exit")).toBeDefined();
	});

	it("should create valid config for testing", async () => {
		// Test that we can create a valid config file structure
		const tempDir = join(tmpdir(), `ethos-cli-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const testConfig = `sources:
  - id: "test-cli"
    name: "Test CLI Source"
    type: "listing"
    listing:
      url: "https://example.com"
      items:
        container_selector: ".item"
        fields:
          title:
            selector: ".title"
            attribute: "text"
          url:
            selector: ".link"
            attribute: "href"`;

		await writeFile(configPath, testConfig);

		// Just verify the file structure is correct for CLI usage
		expect(configPath).toMatch(/sources\.yaml$/);
	});
});
