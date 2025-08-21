import type { Request, Response } from "express";
import { ApiError } from "@/server/middleware/error.js";
import type {
	ApiListResponse,
	PublicationResponse,
	PublicationsQueryParams,
} from "@/server/types.js";
import { ApiErrorType } from "@/server/types.js";
import {
	calculatePagination,
	parseQueryParams,
	validateLimit,
} from "@/server/utils/pagination.js";
import type { ContentStore } from "@/storage/ContentStore.js";
import type {
	ContentMetadata,
	MetadataQueryOptions,
	MetadataStore,
} from "@/storage/MetadataStore.js";

export const getPublicationsHandler = (
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

			const queryOptions: PublicationsQueryParams & {
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

			const query: MetadataQueryOptions = {
				...queryOptions,
				startPublishedDate: queryOptions.startPublishedDate
					? new Date(queryOptions.startPublishedDate)
					: undefined,
				endPublishedDate: queryOptions.endPublishedDate
					? new Date(queryOptions.endPublishedDate)
					: undefined,
				limit: validatedLimit,
				offset: (page - 1) * validatedLimit,
				orderBy: "published_date",
			};

			const total = metadataStore.countQuery(query);

			const paginationMeta = calculatePagination(total, page, validatedLimit);

			let metadataItems: ContentMetadata[] = [];

			metadataItems = metadataStore.query(query);

			const publicationPromises = metadataItems.map(
				async (metadata): Promise<PublicationResponse | null> => {
					const content = await contentStore.retrieve(metadata.url);
					if (content) {
						return {
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
					}
					return null;
				},
			);

			const publicationResults = await Promise.all(publicationPromises);
			const publications = publicationResults.filter(
				(pub): pub is PublicationResponse => pub !== null,
			);

			const response: ApiListResponse<PublicationResponse> = {
				results: publications,
				meta: paginationMeta,
			};
			res.json(response);
		} catch (error) {
			if (error instanceof Error) {
				throw new ApiError(ApiErrorType.INTERNAL_ERROR, error.message);
			}
			throw new ApiError(
				ApiErrorType.INTERNAL_ERROR,
				"Failed to fetch publications",
			);
		}
	};
};

export const getPublicationByHashHandler = (
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
				throw new ApiError(ApiErrorType.NOT_FOUND, "Metadata not found");
			}

			const content = await contentStore.retrieve(metadata.url);
			if (!content) {
				throw new ApiError(ApiErrorType.NOT_FOUND, "Content not found");
			}

			const publication: PublicationResponse = {
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

			res.json(publication);
		} catch (error) {
			if (error instanceof ApiError) {
				throw error;
			}
			if (error instanceof Error) {
				throw new ApiError(ApiErrorType.INTERNAL_ERROR, error.message);
			}
			throw new ApiError(
				ApiErrorType.INTERNAL_ERROR,
				"Failed to fetch publication",
			);
		}
	};
};
