import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AccessNowSource as config } from "@/config/sources/access_now.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture4 from "@/tests/__fixtures__/access_now/biden-digital-rights";
import fixture2 from "@/tests/__fixtures__/access_now/kenya-sim-card-biometrics";
import fixture1 from "@/tests/__fixtures__/access_now/russias-record-war-on-connectivity";
import fixture3 from "@/tests/__fixtures__/access_now/vodafone-challenged-release-transparency-report";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Access Now integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl Access Now listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	it("should crawl to next Access Now listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple Access Now content pages", async () => {
		const testCases = [
			{
				url: "https://www.accessnow.org/russias-record-war-on-connectivity/",
				expectedTitle: "Russia’s record war on connectivity",
				expectedAuthor: "Anastasiya",
				expectedContent: fixture1,
			},
			{
				url: "https://www.accessnow.org/kenya-sim-card-biometrics/",
				expectedTitle:
					"Why Kenyans should say no to biometrics for SIM card registry",
				expectedAuthor: "Bridget Jaimee Kokonya",
				expectedContent: fixture2,
			},
			{
				url: "https://www.accessnow.org/vodafone-challenged-release-transparency-report/",
				expectedTitle: "Vodafone Challenged to Release Transparency Report",
				expectedAuthor: "Peter Micek",
				expectedContent: fixture3,
			},
			{
				url: "https://www.accessnow.org/biden-digital-rights/",
				expectedTitle:
					"Six months in, Biden must speed progress on digital rights",
				expectedAuthor: "Jennifer Brody Eric Null Peter Micek",
				expectedContent: fixture4,
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
