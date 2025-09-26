import type { Request, Response } from "express";
import * as jsdom from "jsdom";
import { marked } from "marked";
import { sources } from "@/config/sources";
import { ApiError } from "@/server/middleware/error.js";
import { ApiErrorType } from "@/server/types.js";
import {
	calculatePagination,
	parseQueryParams,
	validateLimit,
} from "@/server/utils/pagination.js";
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
					const maxLength = 250;
					const html =
						(marked(publication.content) as string) ?? "<html></html>";
					const content = new jsdom.JSDOM(html).window.document.body
						.textContent;
					const truncated = `${content.substring(0, maxLength).trim()}...`;
					return {
						...publication,
						content: truncated,
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
