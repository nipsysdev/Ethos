import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/middleware/error.js";
import {
	getContentByHashHandler,
	getContentHandler,
} from "@/server/routes/content.js";
import { ApiErrorType } from "@/server/types.js";
import { success } from "@/server/utils/response.js";

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

describe("Content Handlers", () => {
	let mockReq: any;
	let mockRes: any;

	beforeEach(() => {
		mockReq = {
			query: {},
			params: {},
		};
		mockRes = {
			json: vi.fn(),
		};
		vi.clearAllMocks();
	});

	describe("getContentHandler", () => {
		it("should return paginated content items", async () => {
			// Setup
			mockReq.query = { page: "1", limit: "10", source: "test-source" };
			const mockMetadata = [
				{
					id: 1, // id is still part of ContentMetadata from storage, but not in response
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
				image: "https://example.com/image1.jpg",
			};

			mockMetadataStore.countQuery.mockReturnValue(1);
			mockMetadataStore.query.mockReturnValue(mockMetadata);
			mockContentStore.retrieve.mockResolvedValue(mockContent);

			// Execute
			const handler = getContentHandler(mockMetadataStore, mockContentStore);
			await handler(mockReq, mockRes);

			// Assert
			expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
				source: "test-source",
				startPublishedDate: undefined,
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
			expect(mockMetadataStore.query).toHaveBeenCalledWith({
				source: "test-source",
				startPublishedDate: undefined,
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
			expect(mockContentStore.retrieve).toHaveBeenCalledWith(
				"https://example.com/1",
			);
			expect(mockRes.json).toHaveBeenCalledWith(
				success(
					[
						{
							url: "https://example.com/1",
							title: "Test Title 1",
							content: "Test content 1",
							author: "Test Author",
							publishedDate: new Date("2023-01-01").toISOString(),
							image: "https://example.com/image1.jpg",
							source: "test-source",
							crawledAt: mockMetadata[0].crawledAt,
							hash: "hash1",
						},
					],
					{
						total: 1,
						page: 1,
						limit: 10,
						totalPages: 1,
					},
				),
			);
		});

		it("should handle empty results", async () => {
			// Setup
			mockReq.query = { source: "empty-source" };
			mockMetadataStore.countQuery.mockReturnValue(0);
			mockMetadataStore.query.mockReturnValue([]);

			// Execute
			const handler = getContentHandler(mockMetadataStore, mockContentStore);
			await handler(mockReq, mockRes);

			// Assert
			expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
				source: "empty-source",
				startPublishedDate: undefined,
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
			expect(mockMetadataStore.query).toHaveBeenCalledWith({
				source: "empty-source",
				startPublishedDate: undefined,
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
			expect(mockRes.json).toHaveBeenCalledWith(
				success([], {
					total: 0,
					page: 1,
					limit: 10,
					totalPages: 0,
				}),
			);
		});

		it("should use query method when no source specified", async () => {
			// Setup
			mockReq.query = { startPublishedDate: "2023-01-01" };
			const mockMetadata = [
				{
					id: 1, // id is still part of ContentMetadata from storage
					url: "https://example.com/1",
					title: "Test Title 1",
					source: "source1",
					crawledAt: new Date(),
					hash: "hash1",
				},
			];
			const mockContent = { content: "Test content 1" };

			mockMetadataStore.countQuery.mockReturnValue(1);
			mockMetadataStore.query.mockReturnValue(mockMetadata);
			mockContentStore.retrieve.mockResolvedValue(mockContent);

			// Execute
			const handler = getContentHandler(mockMetadataStore, mockContentStore);
			await handler(mockReq, mockRes);

			// Assert
			expect(mockMetadataStore.countQuery).toHaveBeenCalledWith({
				source: undefined,
				startPublishedDate: new Date("2023-01-01"),
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
			expect(mockMetadataStore.query).toHaveBeenCalledWith({
				source: undefined,
				startPublishedDate: new Date("2023-01-01"),
				endPublishedDate: undefined,
				limit: 10,
				offset: 0,
			});
		});

		it("should throw internal error on database failure", async () => {
			// Setup
			mockReq.query = { source: "test-source" };
			mockMetadataStore.countQuery.mockImplementation(() => {
				throw new Error("Database error");
			});

			// Execute & Assert
			const handler = getContentHandler(mockMetadataStore, mockContentStore);
			await expect(handler(mockReq, mockRes)).rejects.toThrow(ApiError);
		});
	});

	describe("getContentByHashHandler", () => {
		it("should return content item by hash", async () => {
			// Setup
			mockReq.params = { hash: "hash1" };
			const mockMetadata = {
				id: 1, // id is still part of ContentMetadata from storage
				url: "https://example.com/1",
				title: "Test Title 1",
				author: "Test Author",
				publishedDate: new Date("2023-01-01"),
				source: "test-source",
				crawledAt: new Date(),
				hash: "hash1",
			};
			const mockContent = {
				content: "Test content 1",
				image: "https://example.com/image1.jpg",
			};

			mockMetadataStore.getByHash.mockReturnValue(mockMetadata);
			mockContentStore.retrieve.mockResolvedValue(mockContent);

			// Execute
			const handler = getContentByHashHandler(
				mockMetadataStore,
				mockContentStore,
			);
			await handler(mockReq, mockRes);

			// Assert
			expect(mockMetadataStore.getByHash).toHaveBeenCalledWith("hash1");
			expect(mockContentStore.retrieve).toHaveBeenCalledWith(
				"https://example.com/1",
			);
			expect(mockRes.json).toHaveBeenCalledWith(
				success({
					url: "https://example.com/1",
					title: "Test Title 1",
					content: "Test content 1",
					author: "Test Author",
					publishedDate: new Date("2023-01-01").toISOString(),
					image: "https://example.com/image1.jpg",
					source: "test-source",
					crawledAt: mockMetadata.crawledAt,
					hash: "hash1",
				}),
			);
		});

		it("should throw validation error for invalid hash", async () => {
			// Setup
			mockReq.params = { hash: "" };

			// Execute & Assert
			const handler = getContentByHashHandler(
				mockMetadataStore,
				mockContentStore,
			);
			await expect(handler(mockReq, mockRes)).rejects.toThrow(
				new ApiError(ApiErrorType.VALIDATION_ERROR, "Invalid content hash"),
			);
		});

		it("should throw not found error for non-existent hash", async () => {
			// Setup
			mockReq.params = { hash: "nonexistenthash" };
			mockMetadataStore.getByHash.mockReturnValue(null);

			// Execute & Assert
			const handler = getContentByHashHandler(
				mockMetadataStore,
				mockContentStore,
			);
			await expect(handler(mockReq, mockRes)).rejects.toThrow(
				new ApiError(ApiErrorType.NOT_FOUND, "Content not found"),
			);
		});

		it("should throw not found error when content not found", async () => {
			// Setup
			mockReq.params = { hash: "hash1" };
			const mockMetadata = {
				id: 1, // id is still part of ContentMetadata from storage
				url: "https://example.com/1",
				title: "Test Title 1",
				source: "test-source",
				crawledAt: new Date(),
				hash: "hash1",
			};

			mockMetadataStore.getByHash.mockReturnValue(mockMetadata);
			mockContentStore.retrieve.mockResolvedValue(null);

			// Execute & Assert
			const handler = getContentByHashHandler(
				mockMetadataStore,
				mockContentStore,
			);
			await expect(handler(mockReq, mockRes)).rejects.toThrow(
				new ApiError(ApiErrorType.NOT_FOUND, "Content not found"),
			);
		});
	});
});
