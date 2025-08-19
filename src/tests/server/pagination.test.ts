import { describe, expect, it } from "vitest";
import {
	calculatePagination,
	getPaginationDefaults,
	parseQueryParams,
	validateLimit,
	validatePage,
} from "@/server/utils/pagination.js";

describe("Pagination Utils", () => {
	describe("calculatePagination", () => {
		it("should calculate pagination metadata correctly", () => {
			const result = calculatePagination(100, 2, 10);

			expect(result).toEqual({
				total: 100,
				page: 2,
				limit: 10,
				totalPages: 10,
			});
		});

		it("should handle empty results", () => {
			const result = calculatePagination(0, 1, 10);

			expect(result).toEqual({
				total: 0,
				page: 1,
				limit: 10,
				totalPages: 0,
			});
		});

		it("should handle single page", () => {
			const result = calculatePagination(5, 1, 10);

			expect(result).toEqual({
				total: 5,
				page: 1,
				limit: 10,
				totalPages: 1,
			});
		});

		it("should handle exact page boundary", () => {
			const result = calculatePagination(100, 10, 10);

			expect(result).toEqual({
				total: 100,
				page: 10,
				limit: 10,
				totalPages: 10,
			});
		});
	});

	describe("parseQueryParams", () => {
		it("should parse valid query parameters", () => {
			const query = {
				page: "2",
				limit: "20",
				source: "test-source",
				startPublishedDate: "2023-01-01",
				endPublishedDate: "2023-12-31",
			};

			const result = parseQueryParams(query);

			expect(result).toEqual({
				page: 2,
				limit: 20,
				source: "test-source",
				startPublishedDate: "2023-01-01",
				endPublishedDate: "2023-12-31",
			});
		});

		it("should handle invalid numeric parameters", () => {
			const query = {
				page: "invalid",
				limit: "not-a-number",
			};

			const result = parseQueryParams(query);

			expect(result).toEqual({});
		});

		it("should handle negative numbers", () => {
			const query = {
				page: "-1",
				limit: "-5",
			};

			const result = parseQueryParams(query);

			expect(result).toEqual({});
		});

		it("should handle zero values", () => {
			const query = {
				page: "0",
				limit: "0",
			};

			const result = parseQueryParams(query);

			expect(result).toEqual({});
		});

		it("should handle missing parameters", () => {
			const query = {};

			const result = parseQueryParams(query);

			expect(result).toEqual({});
		});

		it("should handle extra parameters", () => {
			const query = {
				page: "1",
				limit: "10",
				extra: "ignored",
				another: "also-ignored",
			};

			const result = parseQueryParams(query);

			expect(result).toEqual({
				page: 1,
				limit: 10,
			});
		});
	});

	describe("getPaginationDefaults", () => {
		it("should return correct defaults", () => {
			const result = getPaginationDefaults(10, 100);

			expect(result).toEqual({
				page: 1,
				limit: 10,
			});
		});

		it("should cap limit to max limit", () => {
			const result = getPaginationDefaults(150, 100);

			expect(result).toEqual({
				page: 1,
				limit: 100,
			});
		});
	});

	describe("validateLimit", () => {
		it("should return valid limit unchanged", () => {
			const result = validateLimit(50, 100);

			expect(result).toBe(50);
		});

		it("should cap limit to max limit", () => {
			const result = validateLimit(150, 100);

			expect(result).toBe(100);
		});

		it("should raise limit to minimum", () => {
			const result = validateLimit(0, 100);

			expect(result).toBe(1);
		});

		it("should handle negative limit", () => {
			const result = validateLimit(-10, 100);

			expect(result).toBe(1);
		});
	});
});
