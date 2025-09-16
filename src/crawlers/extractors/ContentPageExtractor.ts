import * as jsdom from "jsdom";
import type { Page } from "puppeteer";
import TurndownService from "turndown";
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
import type { BrowserHandler } from "../handlers/BrowserHandler";

export interface ExtractedContentValues {
	title: string | null;
	author: string | null;
	content: string | null;
}
export type ContentFieldName = keyof ExtractedContentValues;

export interface ContentPageExtractor {
	extractContentPagesConcurrently: (
		items: CrawledData[],
		config: SourceConfig,
		itemOffset: number,
		concurrencyLimit: number,
		metadataStore?: MetadataStore,
		skipExistingUrls?: boolean,
		externalContentErrors?: string[],
		externalContentFieldStats?: FieldExtractionStats[],
		metadataTracker?: {
			addDuplicatesSkipped: (count: number) => void;
			addUrlsExcluded: (count: number) => void;
		},
	) => Promise<void>;
	extractFromContentPage: (
		browser: BrowserHandler,
		page: Page,
		url: string,
		config: SourceConfig,
	) => Promise<ContentExtractionResult>;
	extractContentForSingleItem: (
		browser: BrowserHandler,
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	) => Promise<void>;
}

export interface ContentExtractionData {
	title?: string;
	content?: string;
	author?: string;
	publishedDate?: string;
}

export interface ContentExtractionResult {
	contentData: ContentExtractionData;
	errors: string[];
}

async function extractFromContentPage(
	browser: BrowserHandler,
	page: Page,
	url: string,
	config: SourceConfig,
): Promise<ContentExtractionResult> {
	const turndownService = new TurndownService();

	const contentData: ContentExtractionData = {};
	const errors: string[] = [];

	if (!config.content?.fields) {
		return { contentData, errors };
	}

	try {
		browser.goto(page, url);

		if (config.content.container_selector) {
			try {
				await page.waitForSelector(config.content.container_selector, {
					timeout: DYNAMIC_CONTENT_TIMEOUT,
				});
			} catch {}
		}

		const extractionFunction = createBrowserExtractionFunction();
		const extractionResult = await page.evaluate(
			extractionFunction,
			config.content,
		);

		// Process the extracted content to convert HTML to Markdown
		const processedResults: Record<string, string | null> = {};
		const processingErrors: string[] = [];

		for (const [key, value] of Object.entries(extractionResult.results)) {
			let processedContent = value;

			if (key === "content" && typeof value === "string") {
				const document = new jsdom.JSDOM(value).window.document;

				try {
					processedContent = turndownService.turndown(document);
					// Replace non-breaking spaces (U+00A0) with regular spaces (U+0020)
					processedContent = processedContent
						.replace(/\u00A0/g, " ")
						.replace(/\u00A0/g, " ")
						.replace(/â€œ/g, '"')
						.replace(/â€/g, '"')
						.replace(/â€™/g, "'")
						.replace(/â€˜/g, "'")
						.replace(/â€”/g, "—")
						.replace(/â€“/g, "–");
				} catch (conversionError) {
					processingErrors.push(
						`Markdown conversion failed: ${(conversionError as ReferenceError).message}`,
					);
					processedContent = `${document.body.textContent?.trim()}`;
				}
			}

			processedResults[key] = processedContent;
		}

		Object.assign(contentData, processedResults);
		errors.push(...extractionResult.extractionErrors, ...processingErrors);
	} catch (error) {
		const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);
		errors.push(`Failed to load content page ${absoluteUrl} : ${error}`);
	}

	return { contentData, errors };
}

async function extractContentForSingleItem(
	browser: BrowserHandler,
	page: Page,
	item: CrawledData,
	config: SourceConfig,
	contentErrors: string[],
	contentFieldStats: FieldExtractionStats[],
	itemIndex: number,
): Promise<void> {
	if (!item.url) return;

	try {
		const { contentData, errors } = await extractFromContentPage(
			browser,
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
			const errorMessage = `Content extraction failed for ${item.url} : ${errors.join(", ")}`;
			contentErrors.push(errorMessage);
		}
	} catch (error) {
		const errorMessage = `Failed to extract content data for ${item.url} : ${error}`;

		contentErrors.push(
			`Content extraction failed for ${item.url} : ${errorMessage}`,
		);

		updateItemMetadata(item, [], [], [errorMessage]);
	}
}

export function createContentPageExtractor(
	browserHandler: BrowserHandler,
): ContentPageExtractor {
	const concurrentExtractor = createConcurrentContentExtractor(browserHandler, {
		extractContentForSingleItem,
	});

	return {
		extractContentPagesConcurrently: async (
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
