import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContentMetadataStore } from "@/storage/ContentMetadataStore.js";
import { MetadataStore } from "@/storage/MetadataStore.js";
import { SessionMetadataStore } from "@/storage/SessionMetadataStore.js";

// Mock the individual stores
vi.mock("@/storage/ContentMetadataStore.js", () => ({
	ContentMetadataStore: vi.fn(),
}));

vi.mock("@/storage/SessionMetadataStore.js", () => ({
	SessionMetadataStore: vi.fn(),
}));

describe("MetadataStore Deletion", () => {
	let metadataStore: MetadataStore;
	let mockContentStore: {
		deleteBySource: ReturnType<typeof vi.fn>;
		getHashesBySource: ReturnType<typeof vi.fn>;
	};
	let mockSessionStore: {
		deleteSessionsBySource: ReturnType<typeof vi.fn>;
		countSessionsBySource: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock store methods
		mockContentStore = {
			deleteBySource: vi.fn(),
			getHashesBySource: vi.fn(),
		};

		mockSessionStore = {
			deleteSessionsBySource: vi.fn(),
			countSessionsBySource: vi.fn(),
		};

		// Mock the constructor calls
		vi.mocked(ContentMetadataStore).mockImplementation(
			() => mockContentStore as any,
		);
		vi.mocked(SessionMetadataStore).mockImplementation(
			() => mockSessionStore as any,
		);

		metadataStore = new MetadataStore();
	});

	it("should delete content metadata by source", async () => {
		mockContentStore.deleteBySource.mockReturnValue(5);

		const result = metadataStore.deleteContentBySource("test-source");

		expect(result).toBe(5);
		expect(mockContentStore.deleteBySource).toHaveBeenCalledWith("test-source");
	});

	it("should get content hashes by source", async () => {
		const expectedHashes = ["hash1", "hash2", "hash3"];
		mockContentStore.getHashesBySource.mockReturnValue(expectedHashes);

		const result = metadataStore.getContentHashesBySource("test-source");

		expect(result).toEqual(expectedHashes);
		expect(mockContentStore.getHashesBySource).toHaveBeenCalledWith(
			"test-source",
		);
	});

	it("should delete sessions by source", async () => {
		mockSessionStore.deleteSessionsBySource.mockReturnValue(3);

		const result = metadataStore.deleteSessionsBySource("test-source");

		expect(result).toBe(3);
		expect(mockSessionStore.deleteSessionsBySource).toHaveBeenCalledWith(
			"test-source",
		);
	});

	it("should count sessions by source", async () => {
		mockSessionStore.countSessionsBySource.mockReturnValue(7);

		const result = metadataStore.countSessionsBySource("test-source");

		expect(result).toBe(7);
		expect(mockSessionStore.countSessionsBySource).toHaveBeenCalledWith(
			"test-source",
		);
	});

	it("should handle zero content deletions", async () => {
		mockContentStore.deleteBySource.mockReturnValue(0);

		const result = metadataStore.deleteContentBySource("nonexistent-source");

		expect(result).toBe(0);
		expect(mockContentStore.deleteBySource).toHaveBeenCalledWith(
			"nonexistent-source",
		);
	});

	it("should handle zero session deletions", async () => {
		mockSessionStore.deleteSessionsBySource.mockReturnValue(0);

		const result = metadataStore.deleteSessionsBySource("nonexistent-source");

		expect(result).toBe(0);
		expect(mockSessionStore.deleteSessionsBySource).toHaveBeenCalledWith(
			"nonexistent-source",
		);
	});

	it("should handle empty hash arrays", async () => {
		mockContentStore.getHashesBySource.mockReturnValue([]);

		const result = metadataStore.getContentHashesBySource("empty-source");

		expect(result).toEqual([]);
		expect(mockContentStore.getHashesBySource).toHaveBeenCalledWith(
			"empty-source",
		);
	});
});
