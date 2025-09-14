import { describe, expect, it } from "vitest";
import { parsePublishedDate } from "@/utils/date.js";

describe("Date parsing utilities - Relative dates", () => {
	describe("parsePublishedDate", () => {
		it("should parse 'today' to current date", () => {
			const result = parsePublishedDate("today");

			// Parse the result to check if it's a valid date
			const resultDate = new Date(result);

			// Check that it's a valid date
			expect(resultDate).toBeInstanceOf(Date);
			expect(isNaN(resultDate.getTime())).toBe(false);

			// Check that it's close to the current date (within a few seconds)
			const now = new Date();
			const diff = Math.abs(now.getTime() - resultDate.getTime());
			expect(diff).toBeLessThan(5000); // Within 5 seconds
		});

		it("should parse 'yesterday' to previous day", () => {
			const result = parsePublishedDate("yesterday");

			// Parse the result to check if it's a valid date
			const resultDate = new Date(result);

			// Check that it's a valid date
			expect(resultDate).toBeInstanceOf(Date);
			expect(isNaN(resultDate.getTime())).toBe(false);

			// Check that it's close to yesterday (within a few seconds)
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const diff = Math.abs(yesterday.getTime() - resultDate.getTime());
			expect(diff).toBeLessThan(5000); // Within 5 seconds
		});

		it("should parse 'today' in phrases", () => {
			const result = parsePublishedDate("Published today");

			// Parse the result to check if it's a valid date
			const resultDate = new Date(result);

			// Check that it's a valid date
			expect(resultDate).toBeInstanceOf(Date);
			expect(isNaN(resultDate.getTime())).toBe(false);

			// Check that it's close to the current date (within a few seconds)
			const now = new Date();
			const diff = Math.abs(now.getTime() - resultDate.getTime());
			expect(diff).toBeLessThan(5000); // Within 5 seconds
		});

		it("should parse 'yesterday' in phrases", () => {
			const result = parsePublishedDate("Published yesterday");

			// Parse the result to check if it's a valid date
			const resultDate = new Date(result);

			// Check that it's a valid date
			expect(resultDate).toBeInstanceOf(Date);
			expect(isNaN(resultDate.getTime())).toBe(false);

			// Check that it's close to yesterday (within a few seconds)
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const diff = Math.abs(yesterday.getTime() - resultDate.getTime());
			expect(diff).toBeLessThan(5000); // Within 5 seconds
		});
	});
	it("should parse 'TODAY' in uppercase to current date", () => {
		const result = parsePublishedDate("TODAY");

		// Parse the result to check if it's a valid date
		const resultDate = new Date(result);

		// Check that it's a valid date
		expect(resultDate).toBeInstanceOf(Date);
		expect(isNaN(resultDate.getTime())).toBe(false);

		// Check that it's close to the current date (within a few seconds)
		const now = new Date();
		const diff = Math.abs(now.getTime() - resultDate.getTime());
		expect(diff).toBeLessThan(5000); // Within 5 seconds
	});

	it("should parse 'YESTERDAY' in uppercase to previous day", () => {
		const result = parsePublishedDate("YESTERDAY");

		// Parse the result to check if it's a valid date
		const resultDate = new Date(result);

		// Check that it's a valid date
		expect(resultDate).toBeInstanceOf(Date);
		expect(isNaN(resultDate.getTime())).toBe(false);

		// Check that it's close to yesterday (within a few seconds)
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const diff = Math.abs(yesterday.getTime() - resultDate.getTime());
		expect(diff).toBeLessThan(5000); // Within 5 seconds
	});

	it("should parse 'Today' with mixed case in phrases", () => {
		const result = parsePublishedDate("Published Today");

		// Parse the result to check if it's a valid date
		const resultDate = new Date(result);

		// Check that it's a valid date
		expect(resultDate).toBeInstanceOf(Date);
		expect(isNaN(resultDate.getTime())).toBe(false);

		// Check that it's close to the current date (within a few seconds)
		const now = new Date();
		const diff = Math.abs(now.getTime() - resultDate.getTime());
		expect(diff).toBeLessThan(5000); // Within 5 seconds
	});

	it("should parse 'Yesterday' with mixed case in phrases", () => {
		const result = parsePublishedDate("Published Yesterday");

		// Parse the result to check if it's a valid date
		const resultDate = new Date(result);

		// Check that it's a valid date
		expect(resultDate).toBeInstanceOf(Date);
		expect(isNaN(resultDate.getTime())).toBe(false);

		// Check that it's close to yesterday (within a few seconds)
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const diff = Math.abs(yesterday.getTime() - resultDate.getTime());
		expect(diff).toBeLessThan(5000); // Within 5 seconds
	});
});
