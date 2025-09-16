import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LogosPressEngineSource as config } from "@/config/sources/logos_press_engine.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import fixture1 from "@/tests/__fixtures__/logos_press_engine/august-2025";
import fixture3 from "@/tests/__fixtures__/logos_press_engine/keycard-manifesto";
import fixture2 from "@/tests/__fixtures__/logos_press_engine/logos-a-declaration-of-independence-in-cyberspace";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Logos Press Engine integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl Logos Press Engine listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		console.log(result.items);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	// Logos Press Engine has only 1 page for now
	/* it("should crawl to next Logos Press Engine listing page", async () => {
		const page = await setupPage(browser, config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	}); */

	it("should crawl multiple Logos Press Engine content pages", async () => {
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
