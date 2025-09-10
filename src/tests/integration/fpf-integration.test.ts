import type { Browser as PuppeteerBrowser } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fpfSource as config } from "@/config/sources/fpf.js";
import { createBrowser, setupPage } from "@/crawlers/browser";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture1 from "@/tests/__fixtures__/fpf/a-massive-failure-in-kansas-two-years-since-the-marion-county-record-raid";
import fixture2 from "@/tests/__fixtures__/fpf/how-aaron-swartz-fought-for-government-transparency";
import fixture3 from "@/tests/__fixtures__/fpf/new-election-blog-catalogs-media-suppression-by-candidates-campaigns";
import fixture4 from "@/tests/__fixtures__/fpf/prosecutor-puts-doge-ahead-of-first-amendment";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Freedom Press integration tests", () => {
	let browser: PuppeteerBrowser;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowser();
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl FPF listing page", async () => {
		const page = await setupPage(browser, config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
		expect(result.items.every((item) => !!item.content)).toBeTruthy();
	});

	it("should crawl to next FPF listing page", async () => {
		const page = await setupPage(browser, config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple FPF content pages", async () => {
		const testCases = [
			{
				url: "https://freedom.press/issues/a-massive-failure-in-kansas-two-years-since-the-marion-county-record-raid/",
				expectedTitle:
					"A ‘massive failure’ in Kansas: Two years since the Marion County Record raid",
				expectedContent: fixture1,
			},
			{
				url: "https://freedom.press/issues/how-aaron-swartz-fought-for-government-transparency/",
				expectedTitle: "How Aaron Swartz Fought For Government Transparency",
				expectedContent: fixture2,
			},
			{
				url: "https://freedom.press/issues/new-election-blog-catalogs-media-suppression-by-candidates-campaigns/",
				expectedTitle:
					"New election blog catalogs media suppression by candidates, campaigns",
				expectedContent: fixture3,
			},
			{
				url: "https://freedom.press/issues/prosecutor-puts-doge-ahead-of-first-amendment/",
				expectedTitle: "Prosecutor puts DOGE ahead of First Amendment",
				expectedContent: fixture4,
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
				expect(result.contentData.content).toEqual(testCase.expectedContent);
				expect(result.errors.length).toBe(0);

				await page.close();
			}),
		);
	});
});
