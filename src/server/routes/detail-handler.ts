import type { Request, Response } from "express";
import { marked } from "marked";
import { sources } from "@/config/sources";
import { ApiError } from "@/server/middleware/error.js";
import { ApiErrorType } from "@/server/types.js";
import { parseQueryParams } from "@/server/utils/pagination.js";
import { renderDetail } from "@/server/views/detail.js";
import type { ContentStore } from "@/storage/ContentStore.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import { isHashValid } from "@/utils/hash.js";

export const getDetailViewHandler = (
	metadataStore: MetadataStore,
	contentStore: ContentStore,
) => {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			const { hash } = req.params;
			const queryParams = parseQueryParams(req.query);

			if (!hash || typeof hash !== "string" || !isHashValid(hash)) {
				res.status(404).send();
				return;
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
