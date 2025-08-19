import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import { createContentStore } from "@/storage/ContentStore.js";
import { generateStringHash } from "@/utils/hash.js";

describe("ContentStore - Retrieval & Existence", () => {
	let testStorageDir: string;
	let contentStore: ReturnType<typeof createContentStore>;

	// Sample crawled data for testing
	const sampleData: CrawledData = {
		url: "https://example.com/article1",
		crawledAt: new Date("2024-01-01T12:00:00Z"),
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
		contentStore = createContentStore({
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

	describe("retrieve", () => {
		it("should retrieve stored data by URL", async () => {
			await contentStore.store(sampleData);

			const retrieved = await contentStore.retrieve(sampleData.url);

			// Should only return content data, not tracking metadata
			const expectedContentData = {
				url: sampleData.url,
				title: sampleData.title,
				content: sampleData.content,
				author: sampleData.author,
				publishedDate: sampleData.publishedDate,
			};

			expect(retrieved).toEqual(expectedContentData);
		});

		it("should return null for non-existent URL", async () => {
			const retrieved = await contentStore.retrieve(
				"https://nonexistent.com/article",
			);

			expect(retrieved).toBeNull();
		});

		it("should handle retrieval errors gracefully", async () => {
			// Store data first so the file exists
			await contentStore.store(sampleData);

			// Now corrupt the file by writing invalid JSON
			// Generate hash the same way ContentStore does
			const hash = generateStringHash(sampleData.url);
			const filePath = join(testStorageDir, `${hash}.json`);
			await writeFile(filePath, "invalid json content", "utf8");

			await expect(contentStore.retrieve(sampleData.url)).rejects.toThrow(
				"Failed to retrieve content for URL",
			);
		});
	});

	describe("exists", () => {
		it("should return true for stored content", async () => {
			await contentStore.store(sampleData);

			const exists = await contentStore.exists(sampleData.url);

			expect(exists).toBe(true);
		});

		it("should return false for non-existent content", async () => {
			const exists = await contentStore.exists(
				"https://nonexistent.com/article",
			);

			expect(exists).toBe(false);
		});
	});
});
