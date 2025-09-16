import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { P2pFoundationSource as config } from "@/config/sources/p2p_foundation.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture2 from "@/tests/__fixtures__/p2p_foundation/book-of-the-day-abundance-the-future-is-better-than-you-think";
import fixture3 from "@/tests/__fixtures__/p2p_foundation/great-transition-alternative-paths-better-climate-just-future";
import fixture4 from "@/tests/__fixtures__/p2p_foundation/take-back-the-app-a-dialogue-on-platform-cooperativism-free-software-and-discos";
import fixture1 from "@/tests/__fixtures__/p2p_foundation/trusting-google-or-not";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("P2P Foundation integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl P2P Foundation listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	it("should crawl to next P2P Foundation listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple P2P Foundation content pages", async () => {
		const testCases = [
			{
				url: "https://blog.p2pfoundation.net/trusting-google-or-not/",
				expectedTitle: "Trusting Google, or not?",
				expectedContent: fixture1,
				expectedAuthor: "Michel Bauwens",
			},
			{
				url: "https://blog.p2pfoundation.net/book-of-the-day-abundance-the-future-is-better-than-you-think/",
				expectedTitle:
					"Book of the Day: Abundance – The Future Is Better Than You Think",
				expectedContent: fixture2,
				expectedAuthor: "P2P Foundation",
			},
			{
				url: "https://blog.p2pfoundation.net/great-transition-alternative-paths-better-climate-just-future/",
				expectedTitle:
					"The great transition – Alternative paths for a better and climate just future",
				expectedContent: fixture3,
				expectedAuthor: "Lili Fuhr",
			},
			{
				url: "https://blog.p2pfoundation.net/take-back-the-app-a-dialogue-on-platform-cooperativism-free-software-and-discos/",
				expectedTitle:
					"Take back the App! A dialogue on Platform Cooperativism, Free Software and DisCOs",
				expectedContent: fixture4,
				expectedAuthor: "The Laura Flanders Show",
			},
		];

		await Promise.all(
			testCases.map(async (testCase) => {
				const page = await browser.setupNewPage(testCase.url);
				const extractor = createContentPageExtractor(browser);
				const result = await extractor.extractFromContentPage(
					browser,
					page,
					testCase.url,
					config,
				);

				expect(result.contentData.title).toEqual(testCase.expectedTitle);
				expect(result.contentData.author).toEqual(testCase.expectedAuthor);
				expect(result.contentData.content).toEqual(testCase.expectedContent);
				expect(result.errors.length).toBe(0);

				await page.close();
			}),
		);
	});
});
