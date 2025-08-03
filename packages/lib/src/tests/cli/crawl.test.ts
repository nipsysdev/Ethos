import { describe, expect, it } from "vitest";
import { validatePositiveIntegerOrEmpty } from "@/cli/commands/crawl.js";

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
