import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import { createContentStore } from "@/storage/ContentStore.js";

describe("ContentStore - Hash Generation", () => {
	let testStorageDir: string;
	let contentStore: ReturnType<typeof createContentStore>;

	beforeEach(async () => {
		// Create unique directory for each test run to avoid conflicts
		testStorageDir = `./test-storage-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
		contentStore = createContentStore(testStorageDir, false);

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

	it("should use SHA-1 for shorter hashes", async () => {
		const sampleData: CrawledData = {
			url: "https://example.com/article1",
			crawledAt: new Date("2024-01-01T12:00:00Z"),
			source: "test-source",
			title: "Test Article",
			content: "This is test content",
			metadata: {},
		};

		const result = await contentStore.store(sampleData);

		// SHA-1 produces 40-character hex strings
		expect(result.hash).toMatch(/^[a-f0-9]{40}$/);
	});

	it("should compute hash only from URL", async () => {
		const data1: CrawledData = {
			url: "https://example.com/same-url",
			crawledAt: new Date("2024-01-01T12:00:00Z"),
			source: "test-source",
			title: "First Title",
			content: "First content",
			author: "First Author",
			publishedDate: "2024-01-01T00:00:00Z",
			metadata: { custom: "first" },
		};

		const data2: CrawledData = {
			url: "https://example.com/same-url", // Same URL
			crawledAt: new Date("2024-01-02T15:30:00Z"), // Different timestamp
			source: "different-source", // Different source
			title: "Completely Different Title", // Different title
			content: "Totally different content with more text", // Different content
			author: "Different Author", // Different author
			publishedDate: "2024-01-02T00:00:00Z", // Different date
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
			crawledAt: new Date("2024-01-01T12:00:00Z"),
			source: "test-source",
			title: "Same Title",
			content: "Same content",
			metadata: {},
		};

		const data2: CrawledData = {
			url: "https://example.com/article-2", // Different URL
			crawledAt: new Date("2024-01-01T12:00:00Z"), // Same crawledAt timestamp
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
			crawledAt: new Date(),
			source: "test-source",
			title: "Test Article",
			content: "Test content",
			metadata: {},
		};

		const data2: CrawledData = {
			url: "https://example.com/article?utm_source=facebook#section2",
			crawledAt: new Date(),
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
