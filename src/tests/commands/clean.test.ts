import { afterEach, describe, expect, it, vi } from "vitest";
import { handleClean } from "@/commands/clean.js";
import type { ProcessingPipeline } from "@/core/ProcessingPipeline";
import type { SourceRegistry } from "@/core/SourceRegistry";

// Mock inquirer
const mockPrompt = vi.fn();
vi.doMock("inquirer", () => ({
	default: { prompt: mockPrompt },
}));

describe("Clean Command", () => {
	// Mock source registry
	const mockSourceRegistry = {
		getSource: vi.fn().mockResolvedValue({
			id: "test-source",
			name: "Test Source Name",
		}),
	} as unknown as SourceRegistry;

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should return main when storage not available", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Create mock pipeline with no storage
		const mockPipeline = {
			getMetadataStore: () => null,
			getContentStore: () => null,
		} as unknown as ProcessingPipeline;

		const result = await handleClean(mockSourceRegistry, mockPipeline);

		expect(result).toBe("main");
		expect(consoleSpy).toHaveBeenCalledWith("Error: Storage not available");

		consoleSpy.mockRestore();
	});

	it("should return main when no sources available", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Create mock stores
		const mockMetadataStore = {
			getSources: () => [],
		};
		const mockContentStore = {};

		const mockPipeline = {
			getMetadataStore: () => mockMetadataStore,
			getContentStore: () => mockContentStore,
		} as unknown as ProcessingPipeline;

		const result = await handleClean(mockSourceRegistry, mockPipeline);

		expect(result).toBe("main");
		expect(consoleSpy).toHaveBeenCalledWith(
			"No content found. Nothing to clean!",
		);

		consoleSpy.mockRestore();
	});

	it("should return main when user selects back from source selection", async () => {
		// Mock user selecting back
		mockPrompt.mockResolvedValueOnce({ selectedSource: "back" });

		// Create mock stores with data
		const mockMetadataStore = {
			getSources: () => [{ source: "test-source", count: 5 }],
		};
		const mockContentStore = {};

		const mockPipeline = {
			getMetadataStore: () => mockMetadataStore,
			getContentStore: () => mockContentStore,
		} as unknown as ProcessingPipeline;

		const result = await handleClean(mockSourceRegistry, mockPipeline);

		expect(result).toBe("main");
		expect(mockPrompt).toHaveBeenCalledTimes(1);
	});

	it("should handle navigation back from clean type selection", async () => {
		// Mock user navigation: select source -> back -> back to main
		mockPrompt
			.mockResolvedValueOnce({ selectedSource: "test-source" })
			.mockResolvedValueOnce({ cleanType: "back" })
			.mockResolvedValueOnce({ selectedSource: "back" });

		// Create mock stores
		const mockMetadataStore = {
			getSources: () => [{ source: "test-source", count: 5 }],
			countSessionsBySource: () => 3,
			countBySource: () => 5,
		};
		const mockContentStore = {};

		const mockPipeline = {
			getMetadataStore: () => mockMetadataStore,
			getContentStore: () => mockContentStore,
		} as unknown as ProcessingPipeline;

		const result = await handleClean(mockSourceRegistry, mockPipeline);

		expect(result).toBe("main");
		// The function should call prompt until it gets to the end
		expect(mockPrompt).toHaveBeenCalled();
	});

	it("should handle deletion cancellation", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Mock user flow: select source -> select content -> cancel -> back -> back to main
		mockPrompt
			.mockResolvedValueOnce({ selectedSource: "test-source" })
			.mockResolvedValueOnce({ cleanType: "content" })
			.mockResolvedValueOnce({ confirmed: false })
			.mockResolvedValueOnce({ cleanType: "back" })
			.mockResolvedValueOnce({ selectedSource: "back" });

		// Create mock stores
		const mockMetadataStore = {
			getSources: () => [{ source: "test-source", count: 5 }],
			countSessionsBySource: () => 3,
			countBySource: () => 5,
		};
		const mockContentStore = {};

		const mockPipeline = {
			getMetadataStore: () => mockMetadataStore,
			getContentStore: () => mockContentStore,
		} as unknown as ProcessingPipeline;

		const result = await handleClean(mockSourceRegistry, mockPipeline);

		expect(result).toBe("main");
		expect(consoleSpy).toHaveBeenCalledWith("Cleaning cancelled.");

		consoleSpy.mockRestore();
	});
});
