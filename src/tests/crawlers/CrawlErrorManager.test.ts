import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CrawlErrorManager,
	PatternBasedErrorCategorizer,
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

		errorManager = new CrawlErrorManager(
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
	});

	describe("Error Categorization", () => {
		it("should categorize field extraction warnings correctly", () => {
			const warnings = [
				"Optional field 'author' not found for Item 1",
				"Required field 'title' not found for Item 2",
				"Content extraction failed for URL: example.com",
				"Unknown extraction error",
			];

			errorManager.addFieldExtractionWarnings(warnings);

			// Should categorize listing vs content errors automatically
			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"listing",
				[
					"Optional field 'author' not found for Item 1",
					"Required field 'title' not found for Item 2",
				],
			);

			expect(mockMetadataStore.addSessionErrors).toHaveBeenCalledWith(
				sessionId,
				"content",
				[
					"Content extraction failed for URL: example.com",
					"Unknown extraction error",
				],
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
	});
});

describe("PatternBasedErrorCategorizer", () => {
	let categorizer: PatternBasedErrorCategorizer;

	beforeEach(() => {
		categorizer = new PatternBasedErrorCategorizer();
	});

	it("should categorize listing errors correctly", () => {
		const errors = [
			"Optional field 'author' not found",
			"Required field 'title' not found",
			"Item missing required fields: title, url",
			"Item contained no extractable data",
		];

		const result = categorizer.categorizeErrors(errors);

		expect(result.listingErrors).toEqual(errors);
		expect(result.contentErrors).toEqual([]);
	});

	it("should categorize content errors correctly", () => {
		const errors = [
			"Content extraction failed",
			"Content page load timeout",
			"Content parsing error occurred",
		];

		const result = categorizer.categorizeErrors(errors);

		expect(result.listingErrors).toEqual([]);
		expect(result.contentErrors).toEqual(errors);
	});

	it("should handle mixed error types", () => {
		const errors = [
			"Required field 'title' not found",
			"Content extraction failed",
			"Optional field 'author' not found",
			"Content parsing error",
		];

		const result = categorizer.categorizeErrors(errors);

		expect(result.listingErrors).toEqual([
			"Required field 'title' not found",
			"Optional field 'author' not found",
		]);
		expect(result.contentErrors).toEqual([
			"Content extraction failed",
			"Content parsing error",
		]);
	});
});
