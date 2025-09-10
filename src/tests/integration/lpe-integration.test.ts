import type { Browser as PuppeteerBrowser } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { lpeSource as config } from "@/config/sources/lpe.js";
import { createBrowser, setupPage } from "@/crawlers/browser";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import fixture1 from "@/tests/__fixtures__/lpe/august-2025";
import fixture3 from "@/tests/__fixtures__/lpe/keycard-manifesto";
import fixture2 from "@/tests/__fixtures__/lpe/logos-a-declaration-of-independence-in-cyberspace";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Logos integration tests", () => {
	let browser: PuppeteerBrowser;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowser();
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl LPE listing page", async () => {
		const page = await setupPage(browser, config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		console.log(result.items);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	// Logos Press Engine has only 1 page for now
	/* it("should crawl to next LPE listing page", async () => {
		const page = await setupPage(browser, config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	}); */

	it("should crawl multiple LPE content pages", async () => {
		const testCases = [
			{
				url: "https://press.logos.co/article/august-2025",
				expectedTitle: "State of the Logos Network: August 2025",
				expectedAuthor: "Logos",
				expectedContent: fixture1,
			},
			{
				url: "https://press.logos.co/article/logos-a-declaration-of-independence-in-cyberspace",
				expectedTitle: "Logos: A Declaration of Independence in Cyberspace",
				expectedAuthor: "Logos",
				expectedContent: fixture2,
			},
			{
				url: "https://press.logos.co/article/keycard-manifesto",
				expectedTitle: "We Need Sovereign Tools: A Keycard Manifesto",
				expectedAuthor: "Guy-Louis Grau",
				expectedContent: fixture3,
			},
		];

		await Promise.all(
			testCases.map(async (testCase) => {
				const page = await setupPage(browser, testCase.url);
				const extractor = createContentPageExtractor();
				const result = await extractor.extractFromContentPage(
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
