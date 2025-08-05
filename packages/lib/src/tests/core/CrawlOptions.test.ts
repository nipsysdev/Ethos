import { describe, expect, it } from "vitest";
import type { CrawlOptions } from "@/core/types.js";

describe("CrawlOptions - stopOnAllDuplicates", () => {
	it("should include stopOnAllDuplicates option in CrawlOptions interface", () => {
		// Test that the interface accepts the new option
		const options: CrawlOptions = {
			maxPages: 5,
			stopOnAllDuplicates: false,
		};

		expect(options.stopOnAllDuplicates).toBe(false);
	});

	it("should allow undefined stopOnAllDuplicates (default behavior)", () => {
		// Test that the option is optional
		const options: CrawlOptions = {
			maxPages: 5,
		};

		expect(options.stopOnAllDuplicates).toBeUndefined();
	});

	it("should allow both true and false values", () => {
		const optionsTrue: CrawlOptions = {
			stopOnAllDuplicates: true,
		};

		const optionsFalse: CrawlOptions = {
			stopOnAllDuplicates: false,
		};

		expect(optionsTrue.stopOnAllDuplicates).toBe(true);
		expect(optionsFalse.stopOnAllDuplicates).toBe(false);
	});
});
