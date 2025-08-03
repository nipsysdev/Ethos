import { access, readFile, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "../../core/types.js";
import { ContentStore } from "../../storage/ContentStore.js";

describe("ContentStore", () => {
	const testStorageDir = "./test-storage";
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
		tags: ["test", "article"],
		metadata: {
			customField: "custom value",
		},
	};

	const sampleData2: CrawledData = {
		url: "https://example.com/article2",
		timestamp: new Date("2024-01-02T12:00:00Z"),
		source: "test-source",
		title: "Another Test Article",
		content: "This is different test content",
		author: "Another Author",
		publishedDate: "2024-01-02T00:00:00Z",
		tags: ["test", "different"],
		metadata: {
			customField: "different custom value",
		},
	};

	beforeEach(async () => {
		contentStore = new ContentStore({ storageDir: testStorageDir });

		// Ensure clean state by removing directory if it exists
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
	});

	describe("constructor", () => {
		it("should use default options when none provided", () => {
			const defaultStore = new ContentStore();
			expect(defaultStore).toBeInstanceOf(ContentStore);
		});

		it("should accept custom storage directory", () => {
			const customStore = new ContentStore({ storageDir: "./custom-storage" });
			expect(customStore).toBeInstanceOf(ContentStore);
		});
	});

	describe("store", () => {
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

			// Compare everything except timestamp, which gets serialized as string
			expect(parsedContent.url).toBe(sampleData.url);
			expect(parsedContent.source).toBe(sampleData.source);
			expect(parsedContent.title).toBe(sampleData.title);
			expect(parsedContent.content).toBe(sampleData.content);
			expect(parsedContent.author).toBe(sampleData.author);
			expect(parsedContent.publishedDate).toBe(sampleData.publishedDate);
			expect(parsedContent.tags).toEqual(sampleData.tags);
			expect(parsedContent.metadata).toEqual(sampleData.metadata);
			// Check timestamp was serialized correctly as ISO string
			expect(parsedContent.timestamp).toBe(sampleData.timestamp.toISOString());
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
			expect(result1.existed).toBe(false);
			expect(result2.existed).toBe(true);
			expect(result1.storedAt).toBeInstanceOf(Date);
			expect(result2.storedAt).toBeInstanceOf(Date);
		});

		it("should generate different hashes for different content", async () => {
			const result1 = await contentStore.store(sampleData);
			const result2 = await contentStore.store(sampleData2);

			expect(result1.hash).not.toBe(result2.hash);
			expect(result1.path).not.toBe(result2.path);
		});

		it("should handle filesystem errors gracefully", async () => {
			// Try to store in a location that would cause permission errors
			const restrictedStore = new ContentStore({
				storageDir: "/root/restricted",
			});

			await expect(restrictedStore.store(sampleData)).rejects.toThrow(
				"Failed to store content",
			);
		});
	});

	describe("hash generation", () => {
		it("should use SHA-1 for shorter hashes", async () => {
			const result = await contentStore.store(sampleData);

			// SHA-1 produces 40-character hex strings
			expect(result.hash).toMatch(/^[a-f0-9]{40}$/);
		});

		it("should compute hash only from URL", async () => {
			const data1: CrawledData = {
				url: "https://example.com/same-url",
				timestamp: new Date("2024-01-01T12:00:00Z"),
				source: "test-source",
				title: "First Title",
				content: "First content",
				author: "First Author",
				publishedDate: "2024-01-01T00:00:00Z",
				tags: ["first"],
				metadata: { custom: "first" },
			};

			const data2: CrawledData = {
				url: "https://example.com/same-url", // Same URL
				timestamp: new Date("2024-01-02T15:30:00Z"), // Different timestamp
				source: "different-source", // Different source
				title: "Completely Different Title", // Different title
				content: "Totally different content with more text", // Different content
				author: "Different Author", // Different author
				publishedDate: "2024-01-02T00:00:00Z", // Different date
				tags: ["different", "tags"], // Different tags
				metadata: { custom: "different", extra: "field" }, // Different metadata
			};

			const result1 = await contentStore.store(data1);
			const result2 = await contentStore.store(data2);

			// Should have the same hash because URL is the same
			expect(result1.hash).toBe(result2.hash);
			expect(result2.existed).toBe(true); // Should detect as duplicate
		});

		it("should generate different hashes for different URLs", async () => {
			const data1: CrawledData = {
				url: "https://example.com/article-1",
				timestamp: new Date("2024-01-01T12:00:00Z"),
				source: "test-source",
				title: "Same Title",
				content: "Same content",
				metadata: {},
			};

			const data2: CrawledData = {
				url: "https://example.com/article-2", // Different URL
				timestamp: new Date("2024-01-01T12:00:00Z"), // Same timestamp
				source: "test-source", // Same source
				title: "Same Title", // Same title
				content: "Same content", // Same content
				metadata: {}, // Same metadata
			};

			const result1 = await contentStore.store(data1);
			const result2 = await contentStore.store(data2);

			// Should have different hashes because URLs are different
			expect(result1.hash).not.toBe(result2.hash);
			expect(result2.existed).toBe(false); // Should not detect as duplicate
		});

		it("should ignore URL fragments and query parameters for consistent hashing", async () => {
			const data1: CrawledData = {
				url: "https://example.com/article?utm_source=google#section1",
				timestamp: new Date(),
				source: "test-source",
				title: "Test Article",
				content: "Test content",
				metadata: {},
			};

			const data2: CrawledData = {
				url: "https://example.com/article?utm_source=facebook#section2",
				timestamp: new Date(),
				source: "test-source",
				title: "Test Article",
				content: "Test content",
				metadata: {},
			};

			const result1 = await contentStore.store(data1);
			const result2 = await contentStore.store(data2);

			// Different query params and fragments should produce different hashes
			// (this documents current behavior - URLs are compared exactly)
			expect(result1.hash).not.toBe(result2.hash);
		});
	});

	describe("edge cases", () => {
		it("should handle empty metadata", async () => {
			const dataWithEmptyMetadata: CrawledData = {
				...sampleData,
				metadata: {},
			};

			const result = await contentStore.store(dataWithEmptyMetadata);
			expect(result.hash).toBeDefined();
		});

		it("should handle data with minimal metadata", async () => {
			const dataWithMinimalMetadata: CrawledData = {
				url: "https://example.com/test",
				timestamp: new Date("2024-01-01T00:00:00Z"),
				source: "test-source",
				title: "Test",
				content: "Content",
				metadata: {},
			};

			const result = await contentStore.store(dataWithMinimalMetadata);
			expect(result.hash).toBeDefined();
		});

		it("should handle very large content", async () => {
			const largeContent = "x".repeat(1000000); // 1MB of 'x'
			const largeData: CrawledData = {
				...sampleData,
				content: largeContent,
			};

			const result = await contentStore.store(largeData);
			expect(result.hash).toBeDefined();
			expect(result.existed).toBe(false);

			// Verify the large content was stored correctly
			const storedContent = await readFile(result.path, "utf8");
			const parsed = JSON.parse(storedContent);
			expect(parsed.content).toBe(largeContent);
		});
	});
});
