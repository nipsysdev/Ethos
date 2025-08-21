import type { Request } from "express";
import type { PublicationsQueryParams } from "../types.js";

export interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export const calculatePagination = (
	total: number,
	page: number,
	limit: number,
): PaginationMeta => {
	const totalPages = Math.ceil(total / limit);
	return {
		total,
		page,
		limit,
		totalPages,
	};
};

export const parseQueryParams = (
	query: Request["query"],
): PublicationsQueryParams => {
	const params: PublicationsQueryParams = {};

	if (query.page) {
		const pageStr = Array.isArray(query.page) ? query.page[0] : query.page;
		const page = typeof pageStr === "string" ? parseInt(pageStr, 10) : NaN;
		if (!Number.isNaN(page) && page > 0) {
			params.page = page;
		}
	}

	if (query.limit) {
		const limitStr = Array.isArray(query.limit) ? query.limit[0] : query.limit;
		const limit = typeof limitStr === "string" ? parseInt(limitStr, 10) : NaN;
		if (!Number.isNaN(limit) && limit > 0) {
			params.limit = limit;
		}
	}

	if (query.source) {
		const sourceStr = Array.isArray(query.source)
			? query.source[0]
			: query.source;
		if (typeof sourceStr === "string") {
			params.source = sourceStr;
		}
	}

	if (query.startPublishedDate) {
		const dateStr = Array.isArray(query.startPublishedDate)
			? query.startPublishedDate[0]
			: query.startPublishedDate;
		if (typeof dateStr === "string") {
			params.startPublishedDate = dateStr;
		}
	}

	if (query.endPublishedDate) {
		const dateStr = Array.isArray(query.endPublishedDate)
			? query.endPublishedDate[0]
			: query.endPublishedDate;
		if (typeof dateStr === "string") {
			params.endPublishedDate = dateStr;
		}
	}

	return params;
};

export const getPaginationDefaults = (
	defaultLimit: number,
	maxLimit: number,
) => {
	return {
		page: 1,
		limit: Math.min(defaultLimit, maxLimit),
	};
};

export const validateLimit = (limit: number, maxLimit: number): number => {
	return Math.min(Math.max(limit, 1), maxLimit);
};
