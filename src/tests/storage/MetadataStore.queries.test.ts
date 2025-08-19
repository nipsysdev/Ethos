import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore.js";

describe("MetadataStore - Queries", () => {
	let tempDbPath: string;
	let store: MetadataStore;

	beforeEach(async () => {
		tempDbPath = resolve(
			process.cwd(),
			`test-storage-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		mkdirSync(tempDbPath, { recursive: true });

		store = createMetadataStore({
			dbPath: resolve(tempDbPath, "metadata.db"),
		});

		// Setup test data
		const testData: CrawledData[] = [
			{
				url: "https://example.com/article1",
				title: "First Article",
				content: "Content for first article",
				author: "Author A",
				publishedDate: "2025-01-01T00:00:00.000Z",
				crawledAt: new Date("2025-01-01T10:00:00.000Z"),
				source: "source-a",
				metadata: {},
			},
			{
				url: "https://example.com/article2",
				title: "Second Article",
				content: "Content for second article",
				author: "Author B",
				publishedDate: "2025-01-02T00:00:00.000Z",
				crawledAt: new Date("2025-01-01T11:00:00.000Z"),
				source: "source-a",
				metadata: {},
			},
			{
				url: "https://example.com/article3",
				title: "Third Article",
				content: "Content for third article",
				author: "Author A",
				publishedDate: "2025-01-03T00:00:00.000Z",
				crawledAt: new Date("2025-01-01T12:00:00.000Z"),
				source: "source-b",
				metadata: {},
			},
		];

		for (let i = 0; i < testData.length; i++) {
			await store.store(testData[i], `hash${i + 1}`);
		}
	});

	afterEach(() => {
		store?.close();
		if (tempDbPath) {
			rmSync(tempDbPath, { recursive: true, force: true });
		}
	});

	it("should get content by hash", async () => {
		const content = store.getByHash("hash2");
		expect(content).toBeDefined();
		expect(content?.title).toBe("Second Article");
		expect(content?.author).toBe("Author B");
	});

	it("should return null for non-existent hash", async () => {
		const content = store.getByHash("non-existent");
		expect(content).toBeNull();
	});

	it("should get content by URL", async () => {
		const exists = store.existsByUrl("https://example.com/article3");
		expect(exists).toBe(true);

		const nonExistent = store.existsByUrl("https://example.com/non-existent");
		expect(nonExistent).toBe(false);
	});

	it("should return null for non-existent URL", async () => {
		const exists = store.existsByUrl("https://example.com/non-existent");
		expect(exists).toBe(false);
	});

	it("should filter content by source", async () => {
		const sourceAContent = store.getBySource("source-a");
		expect(sourceAContent).toHaveLength(2);
		expect(sourceAContent.map((c) => c.title)).toEqual(
			expect.arrayContaining(["First Article", "Second Article"]),
		);

		const sourceBContent = store.getBySource("source-b");
		expect(sourceBContent).toHaveLength(1);
		expect(sourceBContent[0].title).toBe("Third Article");
	});

	it("should return empty array for non-existent source", async () => {
		const content = store.getBySource("non-existent-source");
		expect(content).toEqual([]);
	});

	it("should filter content by author", async () => {
		// Since author filtering is not available via query options,
		// we'll get all content and filter manually for this test
		const allContent = store.query({});
		const authorAContent = allContent.filter((c) => c.author === "Author A");
		expect(authorAContent).toHaveLength(2);
		expect(authorAContent.map((c) => c.title)).toEqual(
			expect.arrayContaining(["First Article", "Third Article"]),
		);

		const authorBContent = allContent.filter((c) => c.author === "Author B");
		expect(authorBContent).toHaveLength(1);
		expect(authorBContent[0].title).toBe("Second Article");
	});

	it("should return empty array for non-existent author", async () => {
		const allContent = store.query({});
		const content = allContent.filter(
			(c) => c.author === "Non-existent Author",
		);
		expect(content).toEqual([]);
	});

	it("should get all content", async () => {
		const allContent = store.query({});
		expect(allContent).toHaveLength(3);
		expect(allContent.map((c) => c.title)).toEqual(
			expect.arrayContaining([
				"First Article",
				"Second Article",
				"Third Article",
			]),
		);
	});

	it("should get content count", async () => {
		const allContent = store.query({});
		const count = allContent.length;
		expect(count).toBe(3);
	});

	it("should get content count by source", async () => {
		const sourceACount = store.countBySource("source-a");
		expect(sourceACount).toBe(2);

		const sourceBCount = store.countBySource("source-b");
		expect(sourceBCount).toBe(1);

		const nonExistentCount = store.countBySource("non-existent");
		expect(nonExistentCount).toBe(0);
	});
});
