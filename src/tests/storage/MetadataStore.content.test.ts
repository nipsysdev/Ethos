import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore.js";

describe("MetadataStore - Content Operations", () => {
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

	it("should store content metadata successfully", async () => {
		const crawledData: CrawledData = {
			url: "https://example.com/article1",
			title: "Test Article",
			content: "This is test content",
			author: "Test Author",
			publishedDate: "2025-01-01T00:00:00.000Z",
			crawledAt: new Date(),
			source: "test-source",
			metadata: {},
		};
		const hash = "abcd1234567890";

		await store.store(crawledData, hash);
		const retrieved = await store.getByHash(hash);

		expect(retrieved).toBeDefined();
		expect(retrieved?.title).toBe("Test Article");
		expect(retrieved?.author).toBe("Test Author");
		expect(retrieved?.url).toBe("https://example.com/article1");
	});

	it("should store content without optional fields", async () => {
		const crawledData: CrawledData = {
			url: "https://example.com/minimal",
			title: "Minimal Article",
			content: "Basic content",
			crawledAt: new Date(),
			source: "test-source",
			metadata: {},
		};
		const hash = "minimal123456";

		await store.store(crawledData, hash);
		const retrieved = await store.getByHash(hash);

		expect(retrieved).toBeDefined();
		expect(retrieved?.title).toBe("Minimal Article");
		expect(retrieved?.author).toBeUndefined();
		expect(retrieved?.publishedDate).toBeUndefined();
	});

	it("should handle invalid publishedDate gracefully", async () => {
		const crawledData: CrawledData = {
			url: "https://example.com/invalid-date",
			title: "Article with Invalid Date",
			content: "Content with bad date",
			publishedDate: "invalid-date-format",
			crawledAt: new Date(),
			source: "test-source",
			metadata: {},
		};
		const hash = "invalid123456";

		// The store now validates dates and throws an error for invalid formats
		await expect(store.store(crawledData, hash)).rejects.toThrow(
			"Invalid date format: invalid-date-format",
		);
	});

	it("should prevent duplicate URLs", async () => {
		const crawledData1: CrawledData = {
			url: "https://example.com/duplicate",
			title: "First Article",
			content: "First content",
			crawledAt: new Date(),
			source: "test-source",
			metadata: {},
		};

		const crawledData2: CrawledData = {
			url: "https://example.com/duplicate",
			title: "Second Article",
			content: "Second content",
			crawledAt: new Date(),
			source: "test-source",
			metadata: {},
		};

		await store.store(crawledData1, "hash1");
		await expect(store.store(crawledData2, "hash2")).rejects.toThrow(
			"Content with URL already exists",
		);
	});
});
