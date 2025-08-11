import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import { resolveAbsoluteUrl } from "@/utils/url.js";
import { createBrowserExtractionFunction } from "./BrowserFieldExtractor.js";
import { ConcurrentContentExtractor } from "./ConcurrentContentExtractor.js";
import {
	mergeContentData,
	updateFieldStats,
	updateItemMetadata,
} from "./ContentDataMapper.js";
import { DYNAMIC_CONTENT_TIMEOUT } from "./constants.js";

export interface ContentExtractionResult {
	contentData: Record<string, string | null>;
	errors: string[];
}

export class ContentPageExtractor {
	private readonly concurrentExtractor: ConcurrentContentExtractor;

	constructor() {
		this.concurrentExtractor = new ConcurrentContentExtractor(this);
	}
	async extractFromContentPage(
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
			// Make sure we have an absolute URL
			const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);

			// Navigate to the content page
			await page.goto(absoluteUrl, { waitUntil: "domcontentloaded" });

			// Wait for container elements to appear (handles dynamic content)
			if (config.content.container_selector) {
				try {
					await page.waitForSelector(config.content.container_selector, {
						timeout: DYNAMIC_CONTENT_TIMEOUT,
					});
				} catch {
					// If we can't find the container, continue anyway (might be an empty page)
					console.warn(
						`Warning: Content container selector "${config.content.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds for ${absoluteUrl}`,
					);
				}
			}

			// Extract fields from content page using the browser extraction function
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

	async extractContentPagesConcurrently(
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
	): Promise<void> {
		return this.concurrentExtractor.extractConcurrently(
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
	}

	async extractContentForSingleItem(
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	): Promise<void> {
		if (!item.url) return;

		// Check if we have excerpt content from the listing page
		const hasExcerpt = item.content && item.content.trim().length > 0;

		try {
			const { contentData, errors } = await this.extractFromContentPage(
				page,
				item.url,
				config,
			);

			// Merge content data into the item
			mergeContentData(item, contentData);

			// Update field statistics and get field lists
			const { contentFields, failedContentFields } = updateFieldStats(
				contentData,
				contentFieldStats,
				itemIndex,
			);

			// Update item metadata
			updateItemMetadata(item, contentFields, failedContentFields, errors);

			// Handle errors based on whether we have an excerpt
			if (errors.length > 0) {
				if (hasExcerpt) {
					// Add to errors array for tracking/debugging, but don't throw
					contentErrors.push(
						...errors.map(
							(err) => `Content extraction warning for ${item.url}: ${err}`,
						),
					);
				} else {
					// If no excerpt, content page errors are still logged but don't stop crawling
					const errorMessage = `Content extraction failed for ${item.url} (no excerpt available): ${errors.join(", ")}`;
					contentErrors.push(errorMessage);
					// Don't throw - continue crawling but log the failure for debugging
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
				// Don't throw - continue crawling but log the failure for debugging
			}

			// Add error info to metadata
			updateItemMetadata(item, [], [], [errorMessage]);
		}
	}
}
