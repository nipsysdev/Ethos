import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sources } from "@/config/sources";
import { ApiError } from "@/server/middleware/error.js";
import { getDetailViewHandler } from "@/server/routes/detail-handler.js";
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
vi.mock("@/server/views/detail.js", () => ({
	renderDetail: vi.fn().mockReturnValue("<html>Detail View</html>"),
}));

describe("getDetailViewHandler", () => {
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

	it("should return HTML detail view for publication", async () => {
		// Setup
		mockReq.params = { hash: "hash1" };
		mockReq.query = { page: "1", source: "test-source" };
		const mockMetadata = {
			id: 1,
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
		};

		mockMetadataStore.getByHash.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(mockContent);

		// Execute
		const handler = getDetailViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockMetadataStore.getByHash).toHaveBeenCalledWith("hash1");
		expect(mockContentStore.retrieve).toHaveBeenCalledWith(
			"https://example.com/1",
		);
		expect(mockRes.send).toHaveBeenCalledWith("<html>Detail View</html>");
	});

	it("should throw validation error for invalid hash in detail view", async () => {
		// Setup
		mockReq.params = { hash: "" };

		// Execute & Assert
		const handler = getDetailViewHandler(mockMetadataStore, mockContentStore);
		await expect(handler(mockReq, mockRes)).rejects.toThrow(
			new ApiError(ApiErrorType.VALIDATION_ERROR, "Invalid content hash"),
		);
	});

	it("should throw not found error for non-existent hash in detail view", async () => {
		// Setup
		mockReq.params = { hash: "nonexistenthash" };
		mockMetadataStore.getByHash.mockReturnValue(null);

		// Execute & Assert
		const handler = getDetailViewHandler(mockMetadataStore, mockContentStore);
		await expect(handler(mockReq, mockRes)).rejects.toThrow(
			new ApiError(ApiErrorType.NOT_FOUND, "Metadata not found"),
		);
	});

	it("should throw not found error when content not found in detail view", async () => {
		// Setup
		mockReq.params = { hash: "hash1" };
		const mockMetadata = {
			id: 1,
			url: "https://example.com/1",
			title: "Test Title 1",
			source: "test-source",
			crawledAt: new Date(),
			hash: "hash1",
		};

		mockMetadataStore.getByHash.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(null);

		// Execute & Assert
		const handler = getDetailViewHandler(mockMetadataStore, mockContentStore);
		await expect(handler(mockReq, mockRes)).rejects.toThrow(
			new ApiError(ApiErrorType.NOT_FOUND, "Content not found"),
		);
	});

	it("should pass query parameters to detail view", async () => {
		// Setup
		mockReq.params = { hash: "hash1" };
		mockReq.query = { page: "2", source: "test-source" };
		const mockMetadata = {
			id: 1,
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
		};

		mockMetadataStore.getByHash.mockReturnValue(mockMetadata);
		mockContentStore.retrieve.mockResolvedValue(mockContent);

		// Execute
		const handler = getDetailViewHandler(mockMetadataStore, mockContentStore);
		await handler(mockReq, mockRes);

		// Assert
		expect(mockRes.send).toHaveBeenCalledWith("<html>Detail View</html>");
	});
});
