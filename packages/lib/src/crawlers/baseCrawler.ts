import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export interface CrawlResult {
	url: string;
	title: string;
	content: string;
	timestamp: Date;
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox"],
	});

	try {
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: "networkidle2" });

		const result = await page.evaluate(() => {
			return {
				title: document.title,
				content: document.body.innerText.trim(),
			};
		});

		return {
			url,
			title: result.title,
			content: result.content,
			timestamp: new Date(),
		};
	} finally {
		await browser.close();
	}
}
