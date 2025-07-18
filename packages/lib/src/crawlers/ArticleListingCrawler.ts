import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { CrawledData, Crawler, SourceConfig } from "../core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "../core/types.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export class ArticleListingCrawler implements Crawler {
	type = CRAWLER_TYPES.LISTING;

	async crawl(config: SourceConfig): Promise<CrawledData[]> {
		if (config.type !== CRAWLER_TYPES.LISTING) {
			throw new CrawlerError(
				`Config type must be '${CRAWLER_TYPES.LISTING}' (only supported type in Phase 1)`,
				config.id,
			);
		}

		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		try {
			const page = await browser.newPage();
			await page.goto(config.listing.url, { waitUntil: "networkidle2" });

			const items = await this.extractItemsFromListing(page, config);
			console.log(`Found ${items.length} items to process`);

			return items;
		} catch (error) {
			throw new CrawlerError(
				`Failed to crawl ${config.name}`,
				config.id,
				error instanceof Error ? error : new Error(String(error)),
			);
		} finally {
			await browser.close();
		}
	}

	private async extractItemsFromListing(
		page: Page,
		config: SourceConfig,
	): Promise<CrawledData[]> {
		// Extract all items using the container selector
		const items = await page.evaluate((itemsConfig) => {
			const containers = document.querySelectorAll(
				itemsConfig.container_selector,
			);
			const results: Record<string, string | null>[] = [];

			containers.forEach((container) => {
				const item: Record<string, string | null> = {};
				let hasRequiredFields = true;

				for (const [fieldName, fieldConfig] of Object.entries(
					itemsConfig.fields,
				)) {
					try {
						const element = container.querySelector(fieldConfig.selector);
						let value: string | null = null;

						if (element) {
							if (fieldConfig.attribute === "text") {
								value = element.textContent?.trim() || null;
							} else {
								value = element.getAttribute(fieldConfig.attribute);
							}
						}

						if (value) {
							item[fieldName] = value;
						} else if (!fieldConfig.optional) {
							hasRequiredFields = false;
							break;
						}
					} catch {
						if (!fieldConfig.optional) {
							hasRequiredFields = false;
							break;
						}
					}
				}

				if (hasRequiredFields && Object.keys(item).length > 0) {
					results.push(item);
				}
			});

			return results;
		}, config.listing.items);

		const crawledItems: CrawledData[] = items.map((item) => ({
			url: item.url || "",
			timestamp: new Date(),
			source: config.id,
			title: item.title || "",
			content: item.excerpt || "",
			excerpt: item.excerpt || undefined,
			author: item.author || undefined,
			publishedDate: item.date || undefined,
			image: item.image || undefined,
			tags: [],
			metadata: {
				crawlerType: this.type,
				configId: config.id,
				extractedFields: Object.keys(item),
			},
		}));

		return crawledItems;
	}
}
