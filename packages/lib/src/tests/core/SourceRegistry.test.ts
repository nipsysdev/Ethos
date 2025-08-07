import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SourceRegistry } from "@/core/SourceRegistry.js";
import { CRAWLER_TYPES } from "@/core/types.js";

describe("SourceRegistry", () => {
	it("should load valid YAML config and retrieve sources", async () => {
		const tempDir = join(tmpdir(), `ethos-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const testConfig = `sources:
  - id: "test-eff"
    name: "Test Electronic Frontier Foundation"
    type: "listing"
    listing:
      url: "https://eff.org/updates"
      pagination:
        next_button_selector: ".pager__item.pager__item--next"
      items:
        container_selector: ".views-row article.node"
        fields:
          title:
            selector: ".node__title"
            attribute: "text"
          url:
            selector: ".node__title a"
            attribute: "href"
          date:
            selector: ".node-date"
            attribute: "text"
          excerpt:
            selector: ".node__content"
            attribute: "text"
          author:
            selector: ".node-author"
            attribute: "text"
            optional: true
          image:
            selector: ".teaser-thumbnail img"
            attribute: "src"
            optional: true
    content:
      container_selector: ".node-type-blog"
      fields:
        title:
          selector: ".pane-page-title h1"
          attribute: "text"
        content:
          selector: ".pane-node .node__content"
          attribute: "text"`;

		await writeFile(configPath, testConfig);

		const registry = new SourceRegistry(configPath);
		const sources = await registry.loadSources();

		// Validate that it loaded correctly
		expect(sources).toHaveLength(1);
		expect(sources[0].id).toBe("test-eff");
		expect(sources[0].type).toBe(CRAWLER_TYPES.LISTING);
		expect(sources[0].listing.items.container_selector).toBe(
			".views-row article.node",
		);
		expect(sources[0].listing.items.fields.title.selector).toBe(".node__title");
		expect(sources[0].listing.items.fields.author.optional).toBe(true);

		// Test that we can retrieve by ID
		const source = await registry.getSource("test-eff");
		expect(source).toBeDefined();
		expect(source?.name).toBe("Test Electronic Frontier Foundation");
	});

	it("should handle file not found", async () => {
		const registry = new SourceRegistry("/nonexistent/path/sources.yaml");
		await expect(registry.loadSources()).rejects.toThrow(
			/Failed to load sources/,
		);
	});

	it("should reject invalid config structure", async () => {
		const tempDir = join(tmpdir(), `ethos-test-invalid-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `not_sources: []`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Invalid config: 'sources' must be an array",
		);
	});

	it("should reject invalid source schema", async () => {
		const tempDir = join(tmpdir(), `ethos-test-schema-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "invalid"
    name: "Invalid Source"
    type: "listing"
    listing:
      url: "https://example.com"
      # Missing required items configuration`;

		await writeFile(configPath, invalidConfig);

		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow();
	});

	it("should handle multiple sources and retrieval", async () => {
		const tempDir = join(tmpdir(), `ethos-test-multi-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const testConfig = `sources:
  - id: "test1"
    name: "Test Source 1"
    type: "listing"
    listing:
      url: "https://example1.com"
      items:
        container_selector: ".item"
        fields:
          title:
            selector: ".title"
            attribute: "text"
    content:
      container_selector: ".article"
      fields:
        content:
          selector: ".content"
          attribute: "text"
  - id: "test2"
    name: "Test Source 2"
    type: "listing"
    listing:
      url: "https://example2.com"
      items:
        container_selector: ".item"
        fields:
          title:
            selector: ".title"
            attribute: "text"
    content:
      container_selector: ".article"
      fields:
        content:
          selector: ".content"
          attribute: "text"`;

		await writeFile(configPath, testConfig);
		const registry = new SourceRegistry(configPath);

		const allSources = await registry.getAllSources();
		expect(allSources).toHaveLength(2);
		expect(allSources.find((s) => s.id === "test1")).toBeDefined();
		expect(allSources.find((s) => s.id === "test2")).toBeDefined();
	});

	it("should handle empty config", async () => {
		const tempDir = join(tmpdir(), `ethos-test-empty-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const testConfig = `sources: []`;

		await writeFile(configPath, testConfig);
		const registry = new SourceRegistry(configPath);

		const sources = await registry.loadSources();
		expect(sources).toHaveLength(0);

		const allSources = await registry.getAllSources();
		expect(allSources).toHaveLength(0);

		const source = await registry.getSource("nonexistent");
		expect(source).toBeUndefined();
	});
});
