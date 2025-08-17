import { describe, expect, it, vi } from "vitest";
import { crawlWithOptions } from "@/commands/crawl";
import type { SourceConfig } from "@/core/types";
import { ERROR_MESSAGES } from "@/ui/constants";
import { displaySources } from "@/ui/formatter";
import { validatePositiveIntegerOrEmpty } from "@/ui/utils";

describe("Crawl Command Validation", () => {
	describe("validatePositiveIntegerOrEmpty", () => {
		it("should accept empty string", () => {
			expect(validatePositiveIntegerOrEmpty("")).toBe(true);
		});

		it("should accept positive integers", () => {
			expect(validatePositiveIntegerOrEmpty("1")).toBe(true);
			expect(validatePositiveIntegerOrEmpty("10")).toBe(true);
			expect(validatePositiveIntegerOrEmpty("999")).toBe(true);
		});

		it("should reject zero", () => {
			const result = validatePositiveIntegerOrEmpty("0");
			expect(result).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});

		it("should reject negative numbers", () => {
			const result = validatePositiveIntegerOrEmpty("-1");
			expect(result).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);

			const result2 = validatePositiveIntegerOrEmpty("-10");
			expect(result2).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});

		it("should reject non-numeric strings", () => {
			const result = validatePositiveIntegerOrEmpty("abc");
			expect(result).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);

			const result2 = validatePositiveIntegerOrEmpty("not a number");
			expect(result2).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});

		it("should accept decimal numbers (parseInt truncates)", () => {
			// parseInt("1.5") = 1, which is valid
			expect(validatePositiveIntegerOrEmpty("1.5")).toBe(true);

			// parseInt("3.14") = 3, which is valid
			expect(validatePositiveIntegerOrEmpty("3.14")).toBe(true);

			// parseInt("0.9") = 0, which should be rejected
			const result = validatePositiveIntegerOrEmpty("0.9");
			expect(result).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});

		it("should accept strings with trailing non-digits (parseInt stops at first non-digit)", () => {
			// parseInt("5abc") = 5, which is valid
			expect(validatePositiveIntegerOrEmpty("5abc")).toBe(true);

			// Leading whitespace is handled by parseInt
			expect(validatePositiveIntegerOrEmpty("  10  ")).toBe(true);

			// But if it starts with non-digit, parseInt returns NaN
			const result = validatePositiveIntegerOrEmpty("abc5");
			expect(result).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});

		it("should handle edge cases", () => {
			// Very large numbers (still valid integers)
			expect(validatePositiveIntegerOrEmpty("999999999")).toBe(true);

			// Scientific notation (parseInt stops at first non-digit)
			const result = validatePositiveIntegerOrEmpty("1e5");
			expect(result).toBe(true); // parseInt("1e5") = 1, which is valid

			// Infinity
			const result2 = validatePositiveIntegerOrEmpty("Infinity");
			expect(result2).toBe(
				"Please enter a positive number greater than 0 or leave empty",
			);
		});
	});
});

describe("crawlWithOptions", () => {
	it("should display available sources when source not found", async () => {
		// Mock source registry
		const mockSourceRegistry = {
			getSource: vi.fn().mockResolvedValue(null),
			getAllSources: vi.fn().mockResolvedValue([
				{
					id: "source1",
					name: "Source One",
					type: "listing",
					listing: {
						url: "https://example.com",
						items: {
							container_selector: ".item",
							fields: {},
						},
					},
					content: {
						container_selector: ".content",
						fields: {},
					},
				},
				{
					id: "source2",
					name: "Source Two",
					type: "listing",
					listing: {
						url: "https://example.com",
						items: {
							container_selector: ".item",
							fields: {},
						},
					},
					content: {
						container_selector: ".content",
						fields: {},
					},
				},
			] as SourceConfig[]),
		};

		// Mock pipeline
		const mockPipeline = {
			processSummary: vi.fn(),
		};

		// Mock console.log
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Call crawlWithOptions with non-existent source
		const result = await crawlWithOptions(
			{ source: "non-existent-source" },
			mockSourceRegistry as any,
			mockPipeline as any,
		);

		// Verify the error message and available sources are displayed
		expect(consoleSpy).toHaveBeenCalledWith(ERROR_MESSAGES.SOURCE_NOT_FOUND);
		expect(consoleSpy).toHaveBeenCalledWith(
			`${ERROR_MESSAGES.AVAILABLE_SOURCES} ${displaySources(await mockSourceRegistry.getAllSources())}`,
		);

		// Verify it returns to main menu
		expect(result).toBe("main");

		// Restore console.log
		consoleSpy.mockRestore();
	});
});
