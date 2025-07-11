import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { CrawledData, Crawler, SourceConfig } from "../core/types.js";
import { CrawlerError } from "../core/types.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export class ArticleListingCrawler implements Crawler {
	type = "article-listing";

	async crawl(config: SourceConfig): Promise<CrawledData[]> {
		if (config.type !== "article-listing") {
			throw new CrawlerError(`Invalid config type: ${config.type}`, config.id);
		}

		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		try {
			const page = await browser.newPage();
			await page.goto(config.listing.url, { waitUntil: "networkidle2" });

			// Extract item URLs from the listing page
			const itemUrls = await this.extractItemUrls(page, config);
			console.log(`Found ${itemUrls.length} items to process`);

			const results: CrawledData[] = [];

			// Process each item
			for (const itemUrl of itemUrls) {
				try {
					const itemData = await this.extractItemData(page, itemUrl, config);
					results.push(itemData);
				} catch (error) {
					console.error(`Failed to extract item from ${itemUrl}:`, error);
					// Continue with other items
				}
			}

			return results;
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

	private async extractItemUrls(
		page: Page,
		config: SourceConfig,
	): Promise<string[]> {
		// Extract URLs from the listing page
		const urls = await page.evaluate((selector: string) => {
			const elements = document.querySelectorAll(selector);
			const urls: string[] = [];

			elements.forEach((el) => {
				const link = el.querySelector("a");
				if (link?.href) {
					urls.push(link.href);
				}
			});

			return urls;
		}, config.listing.itemSelector);

		return urls;
	}

	private async extractItemData(
		page: Page,
		itemUrl: string,
		config: SourceConfig,
	): Promise<CrawledData> {
		// Navigate to the item page if we need detail extraction
		if (config.extraction.detail) {
			await page.goto(itemUrl, { waitUntil: "networkidle2" });
		}

		// Extract data based on config
		const extractedData = await page.evaluate((detailConfig) => {
			const data: Record<string, string> = {};

			// Extract detail data (from article page)
			if (detailConfig) {
				for (const [key, selector] of Object.entries(detailConfig)) {
					if (key === "url") continue; // URL is already known

					const element = document.querySelector(selector);
					if (element) {
						data[key] = element.textContent?.trim() || "";
					}
				}
			}

			return data;
		}, config.extraction.detail);

		// Build the final result
		const result = extractedData as Record<string, string>;
		return {
			url: itemUrl,
			timestamp: new Date(),
			source: config.id,
			title: result.title || "",
			content: result.content || "",
			excerpt: result.excerpt,
			author: result.author,
			tags: result.tags
				? result.tags.split(",").map((t: string) => t.trim())
				: [],
			metadata: {
				crawlerType: this.type,
				configId: config.id,
			},
		};
	}
}
