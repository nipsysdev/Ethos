import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CrawlErrorManager,
	createCrawlErrorManager,
} from "@/crawlers/CrawlErrorManager.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

describe("CrawlErrorManager", () => {
	let mockMetadataStore: Partial<MetadataStore>;
	let errorManager: CrawlErrorManager;
	const sessionId = "test-session-123";

	beforeEach(() => {
		// Create mock MetadataStore
		mockMetadataStore = {
			addSessionErrors: vi.fn(),
			getSession: vi.fn(),
		};

		errorManager = createCrawlErrorManager(
			mockMetadataStore as MetadataStore,
			sessionId,
		);
	});

	describe("Error Storage", () => {
		it("should store listing errors directly", () => {
			const errors = [
				"Missing required field: title",
				"Item has no extractable data",
			];

			errorManager.addListingErrors(errors);

			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"listing",
				errors,
			);
		});

		it("should store content errors directly", () => {
			const errors = ["Content extraction failed", "Page load timeout"];

			errorManager.addContentErrors(errors);

			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"content",
				errors,
			);
		});

		it("should handle empty error arrays gracefully", () => {
			errorManager.addListingErrors([]);
			errorManager.addContentErrors([]);

			expect(mockMetadataStore.addSessionErrors).not.toHaveBeenCalled();
		});

		it("should store errors using the generic addErrors method", () => {
			const listingErrors = ["Listing error 1", "Listing error 2"];
			const contentErrors = ["Content error 1", "Content error 2"];

			errorManager.addErrors("listing", listingErrors);
			errorManager.addErrors("content", contentErrors);

			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"listing",
				listingErrors,
			);
			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"content",
				contentErrors,
			);
		});
	});

	describe("Error Retrieval", () => {
		it("should retrieve errors from session metadata", () => {
			const mockSession = {
				sessionId: "test",
				sourceId: "test",
				sourceName: "test",
				startTime: "test",
				endTime: null,
				metadata: JSON.stringify({
					listingErrors: ["Listing error 1", "Listing error 2"],
					contentErrors: ["Content error 1"],
				}),
			};

			const getSessionMock = mockMetadataStore.getSession as ReturnType<
				typeof vi.fn
			>;
			getSessionMock.mockReturnValue(mockSession);

			const result = errorManager.getSessionErrors();

			expect(result).toEqual({
				listingErrors: ["Listing error 1", "Listing error 2"],
				contentErrors: ["Content error 1"],
			});
		});

		it("should handle missing session gracefully", () => {
			const getSessionMock = mockMetadataStore.getSession as ReturnType<
				typeof vi.fn
			>;
			getSessionMock.mockReturnValue(null);

			const result = errorManager.getSessionErrors();

			expect(result).toEqual({
				listingErrors: [],
				contentErrors: [],
			});
		});

		it("should handle session with missing metadata fields", () => {
			const mockSession = {
				sessionId: "test",
				sourceId: "test",
				sourceName: "test",
				startTime: "test",
				endTime: null,
				metadata: JSON.stringify({
					// Intentionally missing listingErrors and contentErrors
				}),
			};

			const getSessionMock = mockMetadataStore.getSession as ReturnType<
				typeof vi.fn
			>;
			getSessionMock.mockReturnValue(mockSession);

			const result = errorManager.getSessionErrors();

			expect(result).toEqual({
				listingErrors: [],
				contentErrors: [],
			});
		});
	});
});
