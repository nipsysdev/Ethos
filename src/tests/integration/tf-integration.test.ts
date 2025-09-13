import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { tfSource as config } from "@/config/sources/tf.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture3 from "@/tests/__fixtures__/tf/employee-who-leaked-spider-man-blu-ray-sentenced-to-nearly-5-years-in-prison-on-gun-charge";
import fixture2 from "@/tests/__fixtures__/tf/github-takes-down-pirate-streaming-app-king-club-following-mpa-complaint-200819";
import fixture1 from "@/tests/__fixtures__/tf/swedish-isp-backs-down-allofmp3com-no-longer-blocked";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("TorrentFreak integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl TF listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	it("should crawl to next TF listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple TF content pages", async () => {
		const testCases = [
			{
				url: "https://torrentfreak.com/swedish-isp-backs-down-allofmp3com-no-longer-blocked/",
				expectedTitle: "Swedish ISP backs down: Allofmp3.com No Longer Blocked",
				expectedAuthor: "by Ben Jones",
				expectedContent: fixture1,
			},
			{
				url: "https://torrentfreak.com/github-takes-down-pirate-streaming-app-king-club-following-mpa-complaint-200819/",
				expectedTitle:
					"GitHub Takes Down Pirate Streaming App ‘King Club’ Following MPA Complaint",
				expectedAuthor: "by Ernesto Van der Sar",
				expectedContent: fixture2,
			},
			{
				url: "https://torrentfreak.com/employee-who-leaked-spider-man-blu-ray-sentenced-to-nearly-5-years-in-prison-on-gun-charge/",
				expectedTitle:
					"Employee Who Leaked ‘Spider-Man’ Blu-ray Sentenced to Nearly 5 Years Prison on Gun Charge",
				expectedAuthor: "by Ernesto Van der Sar",
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
				expect(result.contentData.content).toEqual(testCase.expectedContent);
				expect(result.contentData.author).toEqual(testCase.expectedAuthor);
				expect(result.errors.length).toBe(0);

				await page.close();
			}),
		);
	});
});
