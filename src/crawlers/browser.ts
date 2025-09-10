import type { Browser as PuppeteerBrowser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export async function createBrowser() {
	return await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
}

export async function setupPage(browser: PuppeteerBrowser, url: string) {
	const page = await browser.newPage();

	page.on("error", (error) => {
		console.error(`BROWSER ERROR: ${error.message}`);
	});

	await page.goto(url, { waitUntil: "domcontentloaded" });
	return page;
}
