import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import { MetadataStore } from "@/storage/MetadataStore.js";

describe("MetadataStore", () => {
	let testDbPath: string;
	let metadataStore: MetadataStore;

	// Sample crawled data for testing
	const sampleData: CrawledData = {
		url: "https://example.com/article1",
		timestamp: new Date("2024-01-01T12:00:00Z"),
		source: "test-source",
		title: "Test Article",
		content: "This is test content",
		author: "Test Author",
		publishedDate: "2024-01-01T00:00:00Z",
		metadata: { testField: "testValue" },
	};

	const sampleData2: CrawledData = {
		url: "https://example.com/article2",
		timestamp: new Date("2024-01-02T12:00:00Z"),
		source: "another-source",
		title: "Another Test Article",
		content: "More test content",
		publishedDate: "2024-01-02T00:00:00Z",
		metadata: {},
	};

	beforeEach(() => {
		// Use a unique test database for each test
		testDbPath = join(process.cwd(), `test-metadata-${Date.now()}.db`);
		metadataStore = new MetadataStore({ dbPath: testDbPath });
	});

	afterEach(async () => {
		// Clean up test database
		metadataStore.close();
		try {
			await rm(testDbPath);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Database Initialization", () => {
		it("should create database and tables automatically", () => {
			// Database should be created when MetadataStore is instantiated
			expect(metadataStore.getDatabasePath()).toBe(testDbPath);
		});

		it("should handle existing database gracefully", () => {
			// Create another instance with same path
			const anotherStore = new MetadataStore({ dbPath: testDbPath });
			expect(anotherStore.getDatabasePath()).toBe(testDbPath);
			anotherStore.close();
		});
	});

	describe("Content Storage and Retrieval", () => {
		it("should store content metadata successfully", async () => {
			const hash = "abc123test";
			const result = await metadataStore.store(sampleData, hash);

			expect(result).toMatchObject({
				hash,
				source: sampleData.source,
				url: sampleData.url,
				title: sampleData.title,
				author: sampleData.author,
				crawledAt: sampleData.timestamp,
			});
			expect(result.id).toBeTypeOf("number");
			expect(result.publishedDate).toEqual(
				new Date(sampleData.publishedDate as string),
			);
		});

		it("should store content without optional fields", async () => {
			const dataWithoutOptionals: CrawledData = {
				url: "https://example.com/no-optionals",
				timestamp: new Date(),
				source: "test",
				title: "Title Only",
				content: "Content",
				metadata: {},
			};

			const hash = "xyz789test";
			const result = await metadataStore.store(dataWithoutOptionals, hash);

			expect(result.author).toBeUndefined();
			expect(result.publishedDate).toBeUndefined();
		});

		it("should handle invalid publishedDate gracefully", async () => {
			const dataWithInvalidDate: CrawledData = {
				...sampleData,
				publishedDate: "invalid-date",
			};

			const hash = "invalid123";
			await expect(
				metadataStore.store(dataWithInvalidDate, hash),
			).rejects.toThrow();
		});

		it("should prevent duplicate URLs", async () => {
			const hash1 = "hash1";
			const hash2 = "hash2";

			await metadataStore.store(sampleData, hash1);

			// Try to store same URL with different hash
			await expect(metadataStore.store(sampleData, hash2)).rejects.toThrow(
				/URL already exists/,
			);
		});

		it("should prevent duplicate hashes", async () => {
			const hash = "samehash";

			await metadataStore.store(sampleData, hash);

			// Try to store different URL with same hash
			const differentData = { ...sampleData, url: "https://different.com" };
			await expect(metadataStore.store(differentData, hash)).rejects.toThrow(
				/hash already exists/,
			);
		});
	});

	describe("Existence Checks", () => {
		beforeEach(async () => {
			await metadataStore.store(sampleData, "testhash123");
		});

		it("should check existence by URL", () => {
			expect(metadataStore.existsByUrl(sampleData.url)).toBe(true);
			expect(metadataStore.existsByUrl("https://nonexistent.com")).toBe(false);
		});

		it("should check existence by hash", () => {
			expect(metadataStore.existsByHash("testhash123")).toBe(true);
			expect(metadataStore.existsByHash("nonexistenthash")).toBe(false);
		});
	});

	describe("Data Retrieval", () => {
		beforeEach(async () => {
			await metadataStore.store(sampleData, "hash1");
			await metadataStore.store(sampleData2, "hash2");
		});

		it("should retrieve metadata by hash", () => {
			const result = metadataStore.getByHash("hash1");

			expect(result).toMatchObject({
				hash: "hash1",
				source: sampleData.source,
				url: sampleData.url,
				title: sampleData.title,
			});
		});

		it("should return null for non-existent hash", () => {
			const result = metadataStore.getByHash("nonexistent");
			expect(result).toBeNull();
		});

		it("should retrieve content by source", () => {
			const results = metadataStore.getBySource("test-source");

			expect(results).toHaveLength(1);
			expect(results[0].source).toBe("test-source");
		});

		it("should support pagination", () => {
			const page1 = metadataStore.getBySource("test-source", 1, 0);
			const page2 = metadataStore.getBySource("test-source", 1, 1);

			expect(page1).toHaveLength(1);
			expect(page2).toHaveLength(0); // Only one item for this source
		});

		it("should count content by source", () => {
			expect(metadataStore.countBySource("test-source")).toBe(1);
			expect(metadataStore.countBySource("another-source")).toBe(1);
			expect(metadataStore.countBySource("nonexistent")).toBe(0);
		});
	});

	describe("Advanced Queries", () => {
		beforeEach(async () => {
			// Add some test data with different dates
			const oldData: CrawledData = {
				...sampleData,
				url: "https://old.com",
				timestamp: new Date("2023-12-01T12:00:00Z"),
			};

			const newData: CrawledData = {
				...sampleData,
				url: "https://new.com",
				timestamp: new Date("2024-02-01T12:00:00Z"),
			};

			await metadataStore.store(oldData, "oldhash");
			await metadataStore.store(sampleData, "midhash");
			await metadataStore.store(newData, "newhash");
		});

		it("should query by date range", () => {
			const results = metadataStore.query({
				startDate: new Date("2024-01-01T00:00:00Z"),
				endDate: new Date("2024-01-31T23:59:59Z"),
			});

			expect(results).toHaveLength(1);
			expect(results[0].url).toBe(sampleData.url);
		});

		it("should query by source", () => {
			const results = metadataStore.query({
				source: "test-source",
			});

			expect(results).toHaveLength(3); // All our test data has this source
		});

		it("should combine multiple query criteria", () => {
			const results = metadataStore.query({
				source: "test-source",
				startDate: new Date("2024-01-01T00:00:00Z"),
				limit: 1,
			});

			expect(results).toHaveLength(1);
		});

		it("should respect limit and offset", () => {
			const page1 = metadataStore.query({ limit: 2, offset: 0 });
			const page2 = metadataStore.query({ limit: 2, offset: 2 });

			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(1);
		});
	});

	describe("Source Management", () => {
		beforeEach(async () => {
			await metadataStore.store(sampleData, "hash1");
			await metadataStore.store(sampleData2, "hash2");

			// Add another item for test-source
			const additionalData: CrawledData = {
				...sampleData,
				url: "https://example.com/article3",
			};
			await metadataStore.store(additionalData, "hash3");
		});

		it("should get all sources with counts", () => {
			const sources = metadataStore.getSources();

			expect(sources).toHaveLength(2);

			const testSource = sources.find((s) => s.source === "test-source");
			const anotherSource = sources.find((s) => s.source === "another-source");

			expect(testSource?.count).toBe(2);
			expect(anotherSource?.count).toBe(1);
		});

		it("should order sources by count descending", () => {
			const sources = metadataStore.getSources();

			// test-source should come first (count: 2)
			expect(sources[0].source).toBe("test-source");
			expect(sources[0].count).toBe(2);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid publishedDate formats", async () => {
			const invalidData: CrawledData = {
				...sampleData,
				publishedDate: "not-a-valid-date",
			};

			await expect(
				metadataStore.store(invalidData, "invalid-date-hash"),
			).rejects.toThrow("Invalid date");
		});

		it("should prevent duplicate URLs", async () => {
			const hash1 = "hash1";
			const hash2 = "hash2";

			await metadataStore.store(sampleData, hash1);

			// Try to store same URL with different hash
			await expect(metadataStore.store(sampleData, hash2)).rejects.toThrow(
				/URL already exists/,
			);
		});

		it("should prevent duplicate hashes", async () => {
			const hash = "samehash";

			await metadataStore.store(sampleData, hash);

			// Try to store different URL with same hash
			const differentData = { ...sampleData, url: "https://different.com" };
			await expect(metadataStore.store(differentData, hash)).rejects.toThrow(
				/hash already exists/,
			);
		});
	});
	describe("Session Management", () => {
		it("should create and manage crawl sessions", () => {
			const sessionId = "test-session-123";
			const sourceId = "test-source";
			const sourceName = "Test Source";
			const startTime = new Date("2024-01-01T10:00:00Z");
			const metadata = { testData: "value" };

			const session = metadataStore.createSession(
				sessionId,
				sourceId,
				sourceName,
				startTime,
				metadata,
			);

			expect(session.id).toBe(sessionId);
			expect(session.sourceId).toBe(sourceId);
			expect(session.sourceName).toBe(sourceName);
			expect(session.startTime).toEqual(startTime);
			expect(session.isActive).toBe(true);
			expect(JSON.parse(session.metadata)).toEqual(metadata);
		});

		it("should update session metadata", () => {
			const sessionId = "test-session-update";
			const startTime = new Date();
			const initialMetadata = { step: 1 };
			const updatedMetadata = { step: 2, progress: "50%" };

			metadataStore.createSession(
				sessionId,
				"test-source",
				"Test Source",
				startTime,
				initialMetadata,
			);

			metadataStore.updateSession(sessionId, updatedMetadata);

			const session = metadataStore.getSession(sessionId);
			expect(session).not.toBeNull();
			if (session) {
				expect(JSON.parse(session.metadata)).toEqual(updatedMetadata);
			}
		});

		it("should close sessions", () => {
			const sessionId = "test-session-close";
			const startTime = new Date();

			metadataStore.createSession(
				sessionId,
				"test-source",
				"Test Source",
				startTime,
				{},
			);

			expect(metadataStore.getActiveSession(sessionId)).not.toBeNull();

			metadataStore.closeSession(sessionId);

			expect(metadataStore.getActiveSession(sessionId)).toBeNull();
			expect(metadataStore.getSession(sessionId)).not.toBeNull(); // Still exists but inactive
		});

		it("should link content to sessions with processing order", async () => {
			const sessionId = "test-session-link";
			const startTime = new Date();

			// Create session
			metadataStore.createSession(
				sessionId,
				"test-source",
				"Test Source",
				startTime,
				{},
			);

			// Store content
			const content1 = await metadataStore.store(sampleData, "hash1");
			const content2 = await metadataStore.store(sampleData2, "hash2");

			// Link content to session
			expect(content1.id).toBeDefined();
			expect(content2.id).toBeDefined();
			metadataStore.linkContentToSession(
				sessionId,
				content1.id as number,
				1,
				false,
			);
			metadataStore.linkContentToSession(
				sessionId,
				content2.id as number,
				2,
				true,
			);

			// Get session contents
			const sessionContents = metadataStore.getSessionContents(sessionId);

			expect(sessionContents).toHaveLength(2);
			expect(sessionContents[0].id).toBe(content1.id);
			expect(sessionContents[0].processedOrder).toBe(1);
			expect(sessionContents[0].hadDetailExtractionError).toBe(false);
			expect(sessionContents[1].id).toBe(content2.id);
			expect(sessionContents[1].processedOrder).toBe(2);
			expect(sessionContents[1].hadDetailExtractionError).toBe(true);
		});
	});
});
