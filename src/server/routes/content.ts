import type { Request, Response } from "express";
import type {
	ContentMetadata,
	ContentStore,
	MetadataStore,
} from "../../storage/index.js";
import { ApiError } from "../middleware/error.js";
import type { ContentItemResponse, ContentQueryParams } from "../types.js";
import { ApiErrorType } from "../types.js";
import {
	calculatePagination,
	parseQueryParams,
	validateLimit,
} from "../utils/pagination.js";
import { success } from "../utils/response.js";

export const getContentHandler = (
	metadataStore: MetadataStore,
	contentStore: ContentStore,
) => {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			const queryParams = parseQueryParams(req.query);
			const {
				page = 1,
				limit = 10,
				source,
				startPublishedDate,
				endPublishedDate,
			} = queryParams;

			const validatedLimit = validateLimit(limit, 100);

			const queryOptions: ContentQueryParams & {
				limit?: number;
				offset?: number;
			} = {};
			if (source) {
				queryOptions.source = source;
			}
			if (startPublishedDate) {
				queryOptions.startPublishedDate = startPublishedDate;
			}
			if (endPublishedDate) {
				queryOptions.endPublishedDate = endPublishedDate;
			}

			const query = {
				...queryOptions,
				startPublishedDate: queryOptions.startPublishedDate
					? new Date(queryOptions.startPublishedDate)
					: undefined,
				endPublishedDate: queryOptions.endPublishedDate
					? new Date(queryOptions.endPublishedDate)
					: undefined,
				limit: validatedLimit,
				offset: (page - 1) * validatedLimit,
			};

			const total = metadataStore.countQuery(query);

			const paginationMeta = calculatePagination(total, page, validatedLimit);

			let metadataItems: ContentMetadata[] = [];

			metadataItems = metadataStore.query(query);

			const contentItems: ContentItemResponse[] = [];
			for (const metadata of metadataItems) {
				const content = await contentStore.retrieve(metadata.url);
				if (content) {
					contentItems.push({
						url: metadata.url,
						title: metadata.title,
						content: content.content,
						author: metadata.author,
						publishedDate: metadata.publishedDate?.toISOString(),
						image: content.image,
						source: metadata.source,
						crawledAt: metadata.crawledAt,
						hash: metadata.hash,
					});
				}
			}

			const response = success(contentItems, paginationMeta);
			res.json(response);
		} catch (error) {
			if (error instanceof Error) {
				throw new ApiError(ApiErrorType.INTERNAL_ERROR, error.message);
			}
			throw new ApiError(
				ApiErrorType.INTERNAL_ERROR,
				"Failed to fetch content",
			);
		}
	};
};

export const getContentByHashHandler = (
	metadataStore: MetadataStore,
	contentStore: ContentStore,
) => {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			const { hash } = req.params;

			if (!hash || typeof hash !== "string") {
				throw new ApiError(
					ApiErrorType.VALIDATION_ERROR,
					"Invalid content hash",
				);
			}

			const metadata = metadataStore.getByHash(hash);

			if (!metadata) {
				throw new ApiError(ApiErrorType.NOT_FOUND, "Content not found");
			}

			const content = await contentStore.retrieve(metadata.url);
			if (!content) {
				throw new ApiError(ApiErrorType.NOT_FOUND, "Content not found");
			}

			const contentItem: ContentItemResponse = {
				url: metadata.url,
				title: metadata.title,
				content: content.content,
				author: metadata.author,
				publishedDate: metadata.publishedDate?.toISOString(),
				image: content.image,
				source: metadata.source,
				crawledAt: metadata.crawledAt,
				hash: metadata.hash,
			};

			const response = success(contentItem);
			res.json(response);
		} catch (error) {
			if (error instanceof ApiError) {
				throw error;
			}
			if (error instanceof Error) {
				throw new ApiError(ApiErrorType.INTERNAL_ERROR, error.message);
			}
			throw new ApiError(
				ApiErrorType.INTERNAL_ERROR,
				"Failed to fetch content",
			);
		}
	};
};
