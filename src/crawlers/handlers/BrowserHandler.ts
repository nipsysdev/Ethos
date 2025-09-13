import type { Page } from "puppeteer";
import puppeteer from "puppeteer";
import type { SourceConfig } from "@/core/types";
import { resolveAbsoluteUrl } from "@/utils/url";

export interface BrowserHandler {
	resetBrowser(): Promise<void>;
	setupNewPage(url?: string): Promise<Page>;
	goto(page: Page, url: string): Promise<void>;
	close(): Promise<void>;
}

export async function createBrowserHandler(
	config: SourceConfig,
): Promise<BrowserHandler> {
	const _createBrowser = async () =>
		await puppeteer.launch({
			browser: "chrome",
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	const _goto = async (page: Page, url: string) => {
		const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);

		try {
			await page.goto(absoluteUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
		} catch {}
	};

	let browser = await _createBrowser();

	return {
		async resetBrowser() {
			await browser.close();
			browser = await _createBrowser();
		},
		async setupNewPage(url?: string): Promise<Page> {
			const page = (await browser.newPage())
				.on("request", (request) => {
					if (["media", "image", "font"].includes(request.resourceType())) {
						request.abort();
					} else {
						request.continue();
					}
				})
				.on("error", (error) => {
					console.error(`BROWSER ERROR: ${error.message}`);
				});
			await page.setViewport({ width: 1920, height: 1080 });
			await page.setJavaScriptEnabled(!config.disableJavascript);
			await page.setRequestInterception(true);

			if (url) {
				await _goto(page, url);
			}
			return page;
		},
		async goto(page: Page, url: string): Promise<void> {
			await _goto(page, url);
		},
		async close(): Promise<void> {
			await browser.close();
		},
	};
}
