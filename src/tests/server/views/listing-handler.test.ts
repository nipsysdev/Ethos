import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sources } from "@/config/sources";
import { ApiError } from "@/server/middleware/error.js";
import { getListingViewHandler } from "@/server/routes/listing-handler.js";
import { ApiErrorType } from "@/server/types.js";

// Mock storage
const mockMetadataStore = {
	countBySource: vi.fn(),
	getSources: vi.fn(),
	getBySource: vi.fn(),
	query: vi.fn(),
	store: vi.fn(),
	existsByUrl: vi.fn(),
	getExistingUrls: vi.fn(),
	existsByHash: vi.fn(),
	getByHash: vi.fn(),
	deleteContentBySource: vi.fn(),
	getContentHashesBySource: vi.fn(),
	createSession: vi.fn(),
	updateSession: vi.fn(),
	getSession: vi.fn(),
	getAllSessions: vi.fn(),
	isSessionActive: vi.fn(),
	endSession: vi.fn(),
	linkContentToSession: vi.fn(),
	getSessionContents: vi.fn(),
	deleteSessionsBySource: vi.fn(),
	countSessionsBySource: vi.fn(),
	addSessionErrors: vi.fn(),
	close: vi.fn(),
	checkpoint: vi.fn(),
	getDatabasePath: vi.fn(),
	countQuery: vi.fn(),
};

const mockContentStore = {
	retrieve: vi.fn(),
	store: vi.fn(),
	exists: vi.fn(),
	getStorageDirectory: vi.fn(),
	getMetadataStore: vi.fn(),
	deleteContentFiles: vi.fn(),
	close: vi.fn(),
};

// Mock the render function
vi.mock("@/server/views/listing.js", () => ({
	renderListing: vi.fn().mockReturnValue("<html>Listing View</html>"),
}));

describe("getListingViewHandler", () => {
	let mockReq: Request;
	let mockRes: Response;

	beforeEach(() => {
		mockReq = {
			query: {},
			params: {},
		} as unknown as Request;
		mockRes = {
			json: vi.fn(),
			status: vi.fn().mockReturnThis(),
			send: vi.fn(),
		} as unknown as Response;
		vi.clearAllMocks();
	});

	it("should return HTML listing view with publications", async () => {
		// Setup
		mockReq.query = { page: "1", limit: "10", source: "test-source" };
		const mockMetadata = [
			{
				id: 1,
				url: "https://example.com/1",
				title: "Test Title 1",
				author: "Test Author",
				publishedDate: new Date("2023-01-01"),
				source: "test-source",
				crawledAt: new Date(),
				hash: "hash1",
			},
		];
		const mockContent = {
			content: "Test content 1",
		};

		mockMetadataStore.countQuery.mockReturnValue(1);
		mockMetadataStore.query.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(mockContent);

		// Execute
		const handler = getListingViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
			source: "test-source",
			startPublishedDate: undefined,
			endPublishedDate: undefined,
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
		expect(mockMetadataStore.query).toHaveBeenCalledWith({
			source: "test-source",
			startPublishedDate: undefined,
			endPublishedDate: undefined,
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
		expect(mockContentStore.retrieve).toHaveBeenCalledWith(
			"https://example.com/1",
		);
		expect(mockRes.send).toHaveBeenCalledWith("<html>Listing View</html>");
	});

	it("should handle empty results in listing view", async () => {
		// Setup
		mockReq.query = { source: "empty-source" };
		mockMetadataStore.countQuery.mockReturnValue(0);
		mockMetadataStore.query.mockReturnValue([]);

		// Execute
		const handler = getListingViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
			source: "empty-source",
			startPublishedDate: undefined,
			endPublishedDate: undefined,
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
		expect(mockMetadataStore.query).toHaveBeenCalledWith({
			source: "empty-source",
			startPublishedDate: undefined,
			endPublishedDate: undefined,
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
		expect(mockRes.send).toHaveBeenCalledWith("<html>Listing View</html>");
	});

	it("should truncate content in listing view", async () => {
		// Setup
		mockReq.query = { page: "1", limit: "10" };
		const longContent = "a".repeat(300); // Content longer than 200 chars
		const mockMetadata = [
			{
				id: 1,
				url: "https://example.com/1",
				title: "Test Title 1",
				author: "Test Author",
				publishedDate: new Date("2023-01-01"),
				source: "test-source",
				crawledAt: new Date(),
				hash: "hash1",
			},
		];
		const mockContent = {
			content: longContent,
		};

		mockMetadataStore.countQuery.mockReturnValue(1);
		mockMetadataStore.query.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(mockContent);

		// Execute
		const handler = getListingViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockRes.send).toHaveBeenCalledWith("<html>Listing View</html>");
	});

	it("should handle date range filtering in listing view", async () => {
		// Setup
		mockReq.query = {
			startPublishedDate: "2023-01-01",
			endPublishedDate: "2023-12-31",
		};
		const mockMetadata = [
			{
				id: 1,
				url: "https://example.com/1",
				title: "Test Title 1",
				source: "test-source",
				crawledAt: new Date(),
				hash: "hash1",
			},
		];
		const mockContent = { content: "Test content 1" };

		mockMetadataStore.countQuery.mockReturnValue(1);
		mockMetadataStore.query.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(mockContent);

		// Execute
		const handler = getListingViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
			source: undefined,
			startPublishedDate: new Date("2023-01-01"),
			endPublishedDate: new Date("2023-12-31"),
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
		expect(mockMetadataStore.query).toHaveBeenCalledWith({
			source: undefined,
			startPublishedDate: new Date("2023-01-01"),
			endPublishedDate: new Date("2023-12-31"),
			limit: 10,
			offset: 0,
			orderBy: "published_date",
		});
	});

	it("should throw internal error on database failure in listing view", async () => {
		// Setup
		mockReq.query = { source: "test-source" };
		mockMetadataStore.countQuery.mockImplementation(() => {
			throw new Error("Database error");
		});

		// Execute & Assert
		const handler = getListingViewHandler(mockMetadataStore, mockContentStore);
		await expect(handler(mockReq, mockRes)).rejects.toThrow(ApiError);
	});
});
