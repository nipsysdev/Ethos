import { describe, expect, it } from "vitest";
import { parsePublishedDate } from "@/utils/date.js";

describe("Date parsing utilities", () => {
	describe("parsePublishedDate", () => {
		it("should parse common date formats to ISO strings", () => {
			// Test various formats we see in the content
			expect(parsePublishedDate("July 10, 2025")).toBe(
				"2025-07-10T00:00:00.000Z",
			);
			expect(parsePublishedDate("May 30, 2025")).toBe(
				"2025-05-30T00:00:00.000Z",
			);
			expect(parsePublishedDate("June 26, 2025")).toBe(
				"2025-06-26T00:00:00.000Z",
			);
			expect(parsePublishedDate("August 1, 2025")).toBe(
				"2025-08-01T00:00:00.000Z",
			);
		});

		it("should handle variations with extra spaces and prefixes", () => {
			expect(parsePublishedDate("  July 10, 2025  ")).toBe(
				"2025-07-10T00:00:00.000Z",
			);
			expect(parsePublishedDate("Published July 10, 2025")).toBe(
				"2025-07-10T00:00:00.000Z",
			);
			expect(parsePublishedDate("Posted on May 30, 2025")).toBe(
				"2025-05-30T00:00:00.000Z",
			);
		});

		it("should handle different date formats", () => {
			expect(parsePublishedDate("2025-07-10")).toBe("2025-07-10T00:00:00.000Z");
			expect(parsePublishedDate("10 July 2025")).toBe(
				"2025-07-10T00:00:00.000Z",
			);

			// Handle ISO datetime formats with timezone
			expect(parsePublishedDate("2025-07-25T12:00:00-07:00")).toBe(
				"2025-07-25T15:00:00.000Z",
			);
			expect(parsePublishedDate("2025-07-25T12:00:00Z")).toBe(
				"2025-07-25T08:00:00.000Z",
			);
			expect(parsePublishedDate("2025-07-25T12:00:00.000Z")).toBe(
				"2025-07-25T08:00:00.000Z",
			);
		});

		it("should return undefined for invalid dates", () => {
			expect(() => parsePublishedDate("not a date")).toThrow(
				"Unable to parse date format",
			);
			expect(() => parsePublishedDate("")).toThrow("Invalid date input");
			expect(() => parsePublishedDate(undefined)).toThrow("Invalid date input");
		});
	});
});
