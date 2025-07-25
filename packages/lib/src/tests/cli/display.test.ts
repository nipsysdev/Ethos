import { describe, expect, it, vi } from "vitest";
import { displayResults } from "../../cli/ui/display.js";

describe("display module", () => {
	it("should call displayResults without throwing", () => {
		// Just test that the function exists and doesn't crash
		const mockResult = {
			data: [],
			summary: {
				sourceName: "test",
				sourceId: "test-id",
				startTime: new Date(),
				endTime: new Date(),
				itemsFound: 0,
				itemsProcessed: 0,
				itemsWithErrors: 0,
				fieldStats: [],
				listingErrors: [],
			},
		};

		// Mock console.log to avoid noise in test output
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		expect(() => displayResults(mockResult)).not.toThrow();

		consoleSpy.mockRestore();
	});
});
