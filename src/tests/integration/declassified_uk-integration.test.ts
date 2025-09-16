import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DeclassifiedUkSource as config } from "@/config/sources/declassified_uk.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import fixture4 from "@/tests/__fixtures__/declassified_uk/genocide-questions-avoided-as-starmer-meets-israeli-president";
import fixture1 from "@/tests/__fixtures__/declassified_uk/how-the-uk-security-services-neutralised-the-countrys-leading-liberal-newspaper";
import fixture3 from "@/tests/__fixtures__/declassified_uk/maersk-the-shipping-company-transporting-arms-to-israel";
import fixture2 from "@/tests/__fixtures__/declassified_uk/rishi-sunaks-mission-creep-in-yemen";

const ifDescribe = process.env.INT_TEST === "true" ? describe : describe.skip;

ifDescribe("Declassified UK integration tests", () => {
	let browser: BrowserHandler;
	vi.setConfig({ testTimeout: 60000 });

	beforeAll(async () => {
		browser = await createBrowserHandler(config);
	});

	afterAll(async () => {
		await browser.close();
	});

	it("should crawl Declassified UK listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		const extractor = createListingPageExtractor();
		const result = await extractor.extractItemsFromPage(page, config, [], 0);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => !!item.title)).toBeTruthy();
		expect(result.items.every((item) => !!item.url)).toBeTruthy();
		expect(result.items.every((item) => !!item.publishedDate)).toBeTruthy();
	});

	it("should crawl to next Declassified UK listing page", async () => {
		const page = await browser.setupNewPage(config.listing.url);
		expect(await navigateToNextPage(page, config)).toBeTruthy();
	});

	it("should crawl multiple Declassified UK content pages", async () => {
		const testCases = [
			{
				url: "https://www.declassifieduk.org/how-the-uk-security-services-neutralised-the-countrys-leading-liberal-newspaper/",
				expectedTitle:
					"How the UK Security Services neutralised the country’s leading liberal newspaper",
				expectedAuthor: "MATT KENNARD and MARK CURTIS",
				expectedContent: fixture1,
			},
			{
				url: "https://www.declassifieduk.org/rishi-sunaks-mission-creep-in-yemen/",
				expectedTitle: "Rishi Sunak’s Mission Creep in Yemen",
				expectedAuthor: "PHIL MILLER",
				expectedContent: fixture2,
			},
			{
				url: "https://www.declassifieduk.org/maersk-the-shipping-company-transporting-arms-to-israel/",
				expectedTitle:
					"Maersk: The shipping company transporting arms to Israel",
				expectedAuthor: "JOHN McEVOY",
				expectedContent: fixture3,
			},
			{
				url: "https://www.declassifieduk.org/genocide-questions-avoided-as-starmer-meets-israeli-president/",
				expectedTitle:
					"Genocide questions avoided as Starmer meets Israeli president",
				expectedAuthor: "PHIL MILLER, Martin Williams and Alex Morris",
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
