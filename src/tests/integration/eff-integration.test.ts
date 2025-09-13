import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { effSource as config } from "@/config/sources/eff.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture3 from "@/tests/__fixtures__/eff/21-44";
import fixture1 from "@/tests/__fixtures__/eff/eff-awards-spotlight-software-freedom-law-center-india";
import fixture2 from "@/tests/__fixtures__/eff/eff-commerce-department-we-must-revise-overbroad-export-control-proposal";
import fixture4 from "@/tests/__fixtures__/eff/trailblazing-tech-scholar-danah-boyd-groundbreaking-cyberpunk-author-william-gibson";
import fixture5 from "@/tests/__fixtures__/eff/wiring-big-brother-machine";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Electronics Foundation integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl EFF listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
		expect(result.items.every((item) => !!item.content)).toBeTruthy();
	});

	it("should crawl to next EFF listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple EFF content pages", async () => {
		const testCases = [
			{
				url: "https://www.eff.org/deeplinks/2025/08/eff-awards-spotlight-software-freedom-law-center-india",
				expectedTitle:
					"EFF Awards Spotlight ✨ Software Freedom Law Center, India",
				expectedContent: fixture1,
			},
			{
				url: "https://www.eff.org/deeplinks/2015/07/eff-commerce-department-we-must-revise-overbroad-export-control-proposal",
				expectedTitle:
					"EFF to Commerce Department: We Must Revise Overbroad Export Control Proposal",
				expectedContent: fixture2,
			},
			{
				url: "https://www.eff.org/press/archives/2008/04/21-44",
				expectedTitle:
					"Mathematician challenges U.S. lid on encryption software",
				expectedContent: fixture3,
			},
			{
				url: "https://www.eff.org/press/releases/trailblazing-tech-scholar-danah-boyd-groundbreaking-cyberpunk-author-william-gibson",
				expectedTitle:
					"Trailblazing Tech Scholar danah boyd, Groundbreaking Cyberpunk Author William Gibson, and Influential Surveillance Fighters Oakland Privacy Win EFF’s Pioneer Awards",
				expectedContent: fixture4,
			},
			{
				url: "https://www.eff.org/deeplinks/2010/03/wiring-big-brother-machine",
				expectedTitle: "Wiring Up The Big Brother Machine... And Fighting It",
				expectedContent: fixture5,
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
				expect(result.errors.length).toBe(0);

				await page.close();
			}),
		);
	});
});
