import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SourceRegistry } from "../core/SourceRegistry.js";

describe("SourceRegistry with new schema", () => {
	it("should load and validate the new YAML schema format", async () => {
		// Create a temporary config file with our new schema
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
        current_page_selector: ".pager__item.pager__item--current"
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
            optional: true`;

		await writeFile(configPath, testConfig);

		// Load the config using SourceRegistry
		const registry = new SourceRegistry(configPath);
		const sources = await registry.loadSources();

		// Validate that it loaded correctly
		expect(sources).toHaveLength(1);
		expect(sources[0].id).toBe("test-eff");
		expect(sources[0].type).toBe("listing");
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

	it("should reject invalid schema", async () => {
		const tempDir = join(tmpdir(), `ethos-test-invalid-${Date.now()}`);
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

		// Should throw when trying to load invalid config
		await expect(registry.loadSources()).rejects.toThrow();
	});

	it("should handle file not found", async () => {
		const registry = new SourceRegistry("/nonexistent/path/sources.yaml");
		await expect(registry.loadSources()).rejects.toThrow(
			/Failed to load sources/,
		);
	});

	it("should validate source must be an object", async () => {
		const tempDir = join(tmpdir(), `ethos-test-obj-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - "not an object"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source must be an object",
		);
	});

	it("should validate source id field", async () => {
		const tempDir = join(tmpdir(), `ethos-test-id-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - name: "Test Source"
    type: "listing"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source must have a valid 'id' field",
		);
	});

	it("should validate source name field", async () => {
		const tempDir = join(tmpdir(), `ethos-test-name-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    type: "listing"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' must have a valid 'name' field",
		);
	});

	it("should validate source type field", async () => {
		const tempDir = join(tmpdir(), `ethos-test-type-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "article"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' must have type 'listing'",
		);
	});

	it("should validate listing configuration", async () => {
		const tempDir = join(tmpdir(), `ethos-test-listing-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "listing"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' must have a valid 'listing' configuration",
		);
	});

	it("should validate listing url field", async () => {
		const tempDir = join(tmpdir(), `ethos-test-url-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "listing"
    listing: {}`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' listing must have a valid 'url' field",
		);
	});

	it("should validate items configuration", async () => {
		const tempDir = join(tmpdir(), `ethos-test-items-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "listing"
    listing:
      url: "https://example.com"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' listing must have an 'items' configuration",
		);
	});

	it("should validate container_selector field", async () => {
		const tempDir = join(tmpdir(), `ethos-test-container-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "listing"
    listing:
      url: "https://example.com"
      items: {}`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' items must have a 'container_selector' field",
		);
	});

	it("should validate fields configuration", async () => {
		const tempDir = join(tmpdir(), `ethos-test-fields-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources:
  - id: "test"
    name: "Test Source"
    type: "listing"
    listing:
      url: "https://example.com"
      items:
        container_selector: ".item"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Source 'test' items must have a 'fields' configuration",
		);
	});

	it("should validate config structure - missing sources array", async () => {
		const tempDir = join(tmpdir(), `ethos-test-nosources-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `not_sources: []`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Invalid config: 'sources' must be an array",
		);
	});

	it("should validate config structure - sources not array", async () => {
		const tempDir = join(tmpdir(), `ethos-test-notarray-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "sources.yaml");

		const invalidConfig = `sources: "not an array"`;

		await writeFile(configPath, invalidConfig);
		const registry = new SourceRegistry(configPath);
		await expect(registry.loadSources()).rejects.toThrow(
			"Invalid config: 'sources' must be an array",
		);
	});

	it("should get all sources correctly", async () => {
		const tempDir = join(tmpdir(), `ethos-test-getall-${Date.now()}`);
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
            attribute: "text"`;

		await writeFile(configPath, testConfig);
		const registry = new SourceRegistry(configPath);

		const allSources = await registry.getAllSources();
		expect(allSources).toHaveLength(2);
		expect(allSources.find((s) => s.id === "test1")).toBeDefined();
		expect(allSources.find((s) => s.id === "test2")).toBeDefined();
	});

	it("should handle empty sources array", async () => {
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
