import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "@/ui/constants";

describe("UI Constants", () => {
	it("should have the correct error messages", () => {
		expect(ERROR_MESSAGES.SOURCE_NOT_FOUND).toBe("Source not found");
		expect(ERROR_MESSAGES.AVAILABLE_SOURCES).toBe("Available sources: ");
		expect(ERROR_MESSAGES.CRAWL_FAILED).toBe("Crawl failed");
		expect(ERROR_MESSAGES.NO_SOURCES_CONFIGURED).toBe(
			"No sources configured. Please add sources to src/config/sources/",
		);
	});

	it("should have the new AVAILABLE_SOURCES constant", () => {
		expect(ERROR_MESSAGES.AVAILABLE_SOURCES).toBeDefined();
		expect(typeof ERROR_MESSAGES.AVAILABLE_SOURCES).toBe("string");
		expect(ERROR_MESSAGES.AVAILABLE_SOURCES).toBe("Available sources: ");
	});

	it("should maintain existing error message constants", () => {
		// Verify that existing constants are still present and unchanged
		expect(ERROR_MESSAGES.SOURCE_NOT_FOUND).toBe("Source not found");
		expect(ERROR_MESSAGES.CRAWL_FAILED).toBe("Crawl failed");
		expect(ERROR_MESSAGES.NO_SOURCES_CONFIGURED).toBe(
			"No sources configured. Please add sources to src/config/sources/",
		);
	});
});
