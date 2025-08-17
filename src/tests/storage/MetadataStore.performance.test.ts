import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore.js";

describe("MetadataStore - Performance", () => {
	let tempDbPath: string;
	let store: MetadataStore;

	beforeEach(() => {
		tempDbPath = resolve(
			process.cwd(),
			`test-storage-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		mkdirSync(tempDbPath, { recursive: true });

		store = createMetadataStore({
			dbPath: resolve(tempDbPath, "metadata.db"),
		});
	});

	afterEach(() => {
		store?.close();
		if (tempDbPath) {
			rmSync(tempDbPath, { recursive: true, force: true });
		}
	});

	it("should handle bulk insert operations efficiently", async () => {
		const startTime = Date.now();
		const bulkSize = 1000;

		const bulkData: CrawledData[] = Array.from(
			{ length: bulkSize },
			(_, i) => ({
				url: `https://example.com/bulk-article-${i}`,
				title: `Bulk Article ${i}`,
				content: `Content for article ${i}`,
				author: `Author ${i % 50}`, // 50 different authors
				publishedDate: new Date(2025, 0, (i % 31) + 1).toISOString(),
				timestamp: new Date(),
				source: `source-${i % 10}`, // 10 different sources
				metadata: {},
			}),
		);

		// Store all content
		for (let i = 0; i < bulkData.length; i++) {
			await store.store(bulkData[i], `bulk-hash-${i}`);
		}

		const endTime = Date.now();
		const totalTime = endTime - startTime;

		// Verify all content was stored
		const allResults = store.query({});
		expect(allResults).toHaveLength(bulkSize);

		// Performance assertion (should complete within reasonable time)
		// This is environment-dependent, but should be under 30 seconds for 1000 items
		expect(totalTime).toBeLessThan(30000);

		console.log(`Bulk insert of ${bulkSize} items took ${totalTime}ms`);
	});

	it("should handle concurrent read operations", async () => {
		// Setup test data
		const testData: CrawledData[] = Array.from({ length: 100 }, (_, i) => ({
			url: `https://example.com/concurrent-${i}`,
			title: `Concurrent Article ${i}`,
			content: `Content for concurrent article ${i}`,
			author: "Test Author",
			publishedDate: new Date().toISOString(),
			timestamp: new Date(),
			source: "concurrent-source",
			metadata: {},
		}));

		for (let i = 0; i < testData.length; i++) {
			await store.store(testData[i], `concurrent-hash-${i}`);
		}

		// Perform concurrent read operations
		const startTime = Date.now();
		const concurrentPromises = Array.from({ length: 50 }, (_, i) =>
			store.getByHash(`concurrent-hash-${i}`),
		);

		const results = await Promise.all(concurrentPromises);
		const endTime = Date.now();

		// Verify all reads succeeded
		expect(results).toHaveLength(50);
		expect(results.every((result) => result !== null)).toBe(true);

		console.log(`Concurrent reads took ${endTime - startTime}ms`);
	});

	it("should efficiently query by indexed fields", async () => {
		// Setup data with specific source for querying
		const testData: CrawledData[] = Array.from({ length: 500 }, (_, i) => ({
			url: `https://example.com/indexed-${i}`,
			title: `Indexed Article ${i}`,
			content: `Content for indexed article ${i}`,
			author: "Indexed Author",
			publishedDate: new Date().toISOString(),
			timestamp: new Date(),
			source: "indexed-source",
			metadata: {},
		}));

		for (let i = 0; i < testData.length; i++) {
			await store.store(testData[i], `indexed-hash-${i}`);
		}

		// Test indexed query performance
		const startTime = Date.now();
		const sourceResults = store.getBySource("indexed-source", 1000); // Get more than 500 items
		const endTime = Date.now();

		expect(sourceResults).toHaveLength(500);

		// Indexed queries should be fast (under 1 second)
		const queryTime = endTime - startTime;
		expect(queryTime).toBeLessThan(1000);

		console.log(`Indexed query took ${queryTime}ms`);
	});

	it("should handle large result sets efficiently", async () => {
		// Setup large dataset
		const largeDataSize = 2000;
		const testData: CrawledData[] = Array.from(
			{ length: largeDataSize },
			(_, i) => ({
				url: `https://example.com/large-${i}`,
				title: `Large Article ${i}`,
				content: `Content for large article ${i}`,
				author: `Author ${i % 100}`,
				publishedDate: new Date().toISOString(),
				timestamp: new Date(),
				source: "large-source",
				metadata: {},
			}),
		);

		for (let i = 0; i < testData.length; i++) {
			await store.store(testData[i], `large-hash-${i}`);
		}

		// Test retrieving all content
		const startTime = Date.now();
		const allContent = store.query({});
		const endTime = Date.now();

		expect(allContent).toHaveLength(largeDataSize);

		// Should handle large result sets reasonably fast
		const retrievalTime = endTime - startTime;
		expect(retrievalTime).toBeLessThan(5000);

		console.log(`Retrieved ${largeDataSize} items in ${retrievalTime}ms`);
	});
});
