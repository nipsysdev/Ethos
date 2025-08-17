import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { createBrowserExtractionFunction } from "@/crawlers/extractors/BrowserFieldExtractor";
import { createConcurrentContentExtractor } from "@/crawlers/extractors/ConcurrentContentExtractor";
import {
	mergeContentData,
	updateFieldStats,
	updateItemMetadata,
} from "@/crawlers/extractors/ContentDataMapper";
import { DYNAMIC_CONTENT_TIMEOUT } from "@/crawlers/extractors/constants";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import { resolveAbsoluteUrl } from "@/utils/url.js";

export interface ContentExtractionResult {
	contentData: Record<string, string | null>;
	errors: string[];
}

export async function extractFromContentPage(
	page: Page,
	url: string,
	config: SourceConfig,
): Promise<ContentExtractionResult> {
	const contentData: Record<string, string | null> = {};
	const errors: string[] = [];

	if (!config.content?.fields) {
		return { contentData, errors };
	}

	try {
		const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);

		await page.goto(absoluteUrl, { waitUntil: "domcontentloaded" });

		if (config.content.container_selector) {
			try {
				await page.waitForSelector(config.content.container_selector, {
					timeout: DYNAMIC_CONTENT_TIMEOUT,
				});
			} catch (error) {
				console.warn(
					`Warning: Content container selector "${config.content.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds for ${absoluteUrl}`,
					error,
				);
			}
		}

		const extractionFunction = createBrowserExtractionFunction();
		const extractionResult = await page.evaluate(
			extractionFunction,
			config.content,
		);

		Object.assign(contentData, extractionResult.results);
		errors.push(...extractionResult.extractionErrors);
	} catch (error) {
		const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);
		errors.push(`Failed to load content page ${absoluteUrl}: ${error}`);
	}

	return { contentData, errors };
}

export async function extractContentForSingleItem(
	page: Page,
	item: CrawledData,
	config: SourceConfig,
	contentErrors: string[],
	contentFieldStats: FieldExtractionStats[],
	itemIndex: number,
): Promise<void> {
	if (!item.url) return;

	const hasExcerpt = item.content && item.content.trim().length > 0;

	try {
		const { contentData, errors } = await extractFromContentPage(
			page,
			item.url,
			config,
		);

		mergeContentData(item, contentData);

		const { contentFields, failedContentFields } = updateFieldStats(
			contentData,
			contentFieldStats,
			itemIndex,
		);

		updateItemMetadata(item, contentFields, failedContentFields, errors);

		if (errors.length > 0) {
			if (hasExcerpt) {
				contentErrors.push(
					...errors.map(
						(err) => `Content extraction warning for ${item.url}: ${err}`,
					),
				);
			} else {
				const errorMessage = `Content extraction failed for ${item.url} (no excerpt available): ${errors.join(", ")}`;
				contentErrors.push(errorMessage);
			}
		}
	} catch (error) {
		const errorMessage = `Failed to extract content data for ${item.url}: ${error}`;

		if (hasExcerpt) {
			contentErrors.push(
				`Content extraction warning for ${item.url}: ${errorMessage}`,
			);
		} else {
			contentErrors.push(
				`Content extraction failed for ${item.url}: ${errorMessage}`,
			);
		}

		updateItemMetadata(item, [], [], [errorMessage]);
	}
}

export function createContentPageExtractor() {
	const concurrentExtractor = createConcurrentContentExtractor({
		extractContentForSingleItem,
	});

	return {
		extractContentPagesConcurrently: async (
			page: Page,
			items: CrawledData[],
			config: SourceConfig,
			itemOffset: number,
			concurrencyLimit: number = 5,
			metadataStore?: MetadataStore,
			skipExistingUrls: boolean = true,
			externalContentErrors?: string[],
			externalContentFieldStats?: FieldExtractionStats[],
			metadataTracker?: {
				addDuplicatesSkipped: (count: number) => void;
				addUrlsExcluded: (count: number) => void;
			},
		): Promise<void> => {
			return concurrentExtractor.extractConcurrently(
				page,
				items,
				config,
				itemOffset,
				{
					concurrencyLimit,
					skipExistingUrls,
					metadataStore,
					externalContentErrors,
					externalContentFieldStats,
					metadataTracker,
				},
			);
		},

		extractFromContentPage,

		extractContentForSingleItem,
	};
}
