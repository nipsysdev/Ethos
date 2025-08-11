import { access, readFile, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import { ContentStore } from "@/storage/ContentStore.js";

describe("ContentStore - Store Operations", () => {
	let testStorageDir: string;
	let contentStore: ContentStore;

	// Sample crawled data for testing
	const sampleData: CrawledData = {
		url: "https://example.com/article1",
		timestamp: new Date("2024-01-01T12:00:00Z"),
		source: "test-source",
		title: "Test Article",
		content: "This is test content",
		author: "Test Author",
		publishedDate: "2024-01-01T00:00:00Z",
		metadata: {
			customField: "custom value",
		},
	};

	beforeEach(async () => {
		// Create unique directory for each test run to avoid conflicts
		testStorageDir = `./test-storage-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
		contentStore = new ContentStore({
			storageDir: testStorageDir,
			enableMetadata: false,
		});

		// Ensure clean state by removing directory if it exists
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory doesn't exist, which is fine
		}
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist, which is fine
		}
	});

	it("should store crawled data and return storage result", async () => {
		const result = await contentStore.store(sampleData);

		expect(result).toHaveProperty("hash");
		expect(result).toHaveProperty("path");
		expect(result).toHaveProperty("existed");
		expect(result.hash).toMatch(/^[a-f0-9]{40}$/); // SHA-1 hash
		expect(result.path).toContain("test-storage");
		expect(result.path).toContain(`${result.hash}.json`);
		expect(result.existed).toBe(false);
		expect(result.storedAt).toBeInstanceOf(Date);
	});

	it("should create storage directory if it does not exist", async () => {
		const result = await contentStore.store(sampleData);

		// Verify directory was created
		await expect(access(testStorageDir)).resolves.not.toThrow();

		// Verify file was created
		await expect(access(result.path)).resolves.not.toThrow();
	});

	it("should write correct JSON content to file", async () => {
		const result = await contentStore.store(sampleData);

		const fileContent = await readFile(result.path, "utf8");
		const parsedContent = JSON.parse(fileContent);

		// Check that only content data is stored (no tracking metadata)
		expect(parsedContent.url).toBe(sampleData.url);
		expect(parsedContent.title).toBe(sampleData.title);
		expect(parsedContent.content).toBe(sampleData.content);
		expect(parsedContent.author).toBe(sampleData.author);
		expect(parsedContent.publishedDate).toBe(sampleData.publishedDate);
		// Check that tracking metadata is not in JSON (timestamp, source, metadata)
		expect("timestamp" in parsedContent).toBe(false);
		expect("source" in parsedContent).toBe(false);
		expect("metadata" in parsedContent).toBe(false);
	});

	it("should generate consistent hashes for identical content", async () => {
		const result1 = await contentStore.store(sampleData);

		// Clean up and store the same data again
		await rm(testStorageDir, { recursive: true, force: true });

		const result2 = await contentStore.store(sampleData);

		expect(result1.hash).toBe(result2.hash);
		expect(result1.path).toBe(result2.path);
	});

	it("should detect when file already exists (deduplication)", async () => {
		const result1 = await contentStore.store(sampleData);
		const result2 = await contentStore.store(sampleData);

		expect(result1.hash).toBe(result2.hash);
		expect(result1.existed).toBe(false); // First time
		expect(result2.existed).toBe(true); // Second time (file exists)
	});
});
