import type { Request, Response } from "express";
import { marked } from "marked";
import { sources } from "@/config/sources";
import { ApiError } from "@/server/middleware/error.js";
import { ApiErrorType } from "@/server/types.js";
import {
	calculatePagination,
	parseQueryParams,
	validateLimit,
} from "@/server/utils/pagination.js";
import { renderDetail } from "@/server/views/detail.js";
import { renderListing } from "@/server/views/listing.js";
import type { ContentStore } from "@/storage/ContentStore.js";
import type {
	MetadataQueryOptions,
	MetadataStore,
} from "@/storage/MetadataStore.js";

export const getListingViewHandler = (
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

			const queryOptions: MetadataQueryOptions = {};
			if (source) {
				queryOptions.source = source;
			}
			if (startPublishedDate) {
				queryOptions.startPublishedDate = new Date(startPublishedDate);
			}
			if (endPublishedDate) {
				queryOptions.endPublishedDate = new Date(endPublishedDate);
			}

			const query: MetadataQueryOptions = {
				...queryOptions,
				limit: validatedLimit,
				offset: (page - 1) * validatedLimit,
				orderBy: "published_date",
			};

			const total = metadataStore.countQuery(query);
			const paginationMeta = calculatePagination(total, page, validatedLimit);

			const metadataItems = metadataStore.query(query);

			const publicationPromises = metadataItems.map(async (metadata) => {
				const content = await contentStore.retrieve(metadata.url);
				if (content) {
					return {
						url: metadata.url,
						title: metadata.title,
						content: content.content,
						author: metadata.author,
						publishedDate: metadata.publishedDate?.toISOString(),
						source:
							sources.find((src) => src.id === metadata.source)?.name ??
							"Undefined",
						crawledAt: metadata.crawledAt,
						hash: metadata.hash,
					};
				}
				return null;
			});

			const publicationResults = await Promise.all(publicationPromises);
			const publications = publicationResults
				.filter((pub): pub is NonNullable<typeof pub> => pub !== null)
				.map((publication) => {
					const maxLength = 200;
					const text = publication.content;
					if (text.length <= maxLength) return publication;
					const truncated = `${text.substring(0, maxLength).trim()}...`;
					return {
						...publication,
						content: marked(truncated) as string,
					};
				});

			res.send(
				await renderListing(
					publications,
					paginationMeta,
					sources.map((src) => ({ id: src.id, name: src.name })),
					source,
				),
			);
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

export const getDetailViewHandler = (
	metadataStore: MetadataStore,
	contentStore: ContentStore,
) => {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			const { hash } = req.params;
			const queryParams = parseQueryParams(req.query);

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

			const content = await contentStore
				.retrieve(metadata.url)
				.then((data) => (data?.content ? marked(data.content) : ""));
			if (!content) {
				throw new ApiError(ApiErrorType.NOT_FOUND, "Content not found");
			}

			const publication = {
				url: metadata.url,
				title: metadata.title,
				content,
				author: metadata.author,
				publishedDate: metadata.publishedDate?.toISOString(),
				source:
					sources.find((src) => src.id === metadata.source)?.name ??
					"Undefined",
				crawledAt: metadata.crawledAt,
				hash: metadata.hash,
			};

			res.send(
				renderDetail(publication, {
					page: queryParams.page,
					source: queryParams.source,
				}),
			);
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
