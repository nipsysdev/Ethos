import type { Page, TimeoutError } from "puppeteer";
import type { SourceConfig } from "@/core/types.js";

const PAGINATION_TIMEOUTS = {
	NAVIGATION_SEC: 5,
	CONTAINER_WAIT_SEC: 20,
	CONTENT_LOAD_DELAY_SEC: 1,
	RETRY_DELAY_SEC: 15,
} as const;

const PAGINATION_RETRY = {
	MAX_ATTEMPTS: 3,
} as const;

async function isButtonDisabled(
	page: Page,
	selector: string,
): Promise<boolean> {
	return page.evaluate((sel) => {
		const element = document.querySelector(sel);
		if (!element) return true;

		const htmlElement = element as HTMLElement;
		const isHidden = htmlElement.offsetParent === null;
		const hasDisabledAttr = element.hasAttribute("disabled");
		const hasDisabledClass = element.classList.contains("disabled");
		const hasAriaDisabled = element.getAttribute("aria-disabled") === "true";

		return isHidden || hasDisabledAttr || hasDisabledClass || hasAriaDisabled;
	}, selector);
}

async function attemptPagination(
	page: Page,
	config: SourceConfig,
	nextButtonSelector: string,
): Promise<boolean> {
	const oldUrl = page.url();
	const nextButton = await page.$(nextButtonSelector);
	if (!nextButton?.isVisible) {
		return false;
	}

	const disabled = await isButtonDisabled(page, nextButtonSelector);
	if (disabled) {
		return false;
	}

	await nextButton.click();

	try {
		await page.waitForNavigation({
			waitUntil: "domcontentloaded",
			timeout: PAGINATION_TIMEOUTS.NAVIGATION_SEC * 1000,
		});
	} catch {}

	const waitTime =
		config.listing.pagination?.delaySec ??
		PAGINATION_TIMEOUTS.CONTENT_LOAD_DELAY_SEC;

	console.log(`Waiting ${waitTime}sec`);
	await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

	try {
		await page.waitForSelector(config.listing.container_selector, {
			timeout: PAGINATION_TIMEOUTS.CONTAINER_WAIT_SEC * 1000,
		});
	} catch (error) {
		console.warn(
			`PaginationHandler: ${(error as TimeoutError).message} at url: ${page.url()}`,
		);
		return false;
	}

	if (oldUrl === page.url()) {
		console.warn(`PaginationHandler: Navigated to same url`);
		return false;
	}

	return true;
}

async function retryPagination(
	page: Page,
	config: SourceConfig,
	nextButtonSelector: string,
): Promise<boolean> {
	for (let attempt = 1; attempt <= PAGINATION_RETRY.MAX_ATTEMPTS; attempt++) {
		try {
			const success = await attemptPagination(page, config, nextButtonSelector);
			if (success) {
				return true;
			}
		} catch {}
		if (attempt >= PAGINATION_RETRY.MAX_ATTEMPTS) {
			return false;
		}

		await page.reload();
		await new Promise((resolve) =>
			setTimeout(resolve, PAGINATION_TIMEOUTS.RETRY_DELAY_SEC * 1000),
		);
	}

	return false;
}

export async function navigateToNextPage(
	page: Page,
	config: SourceConfig,
): Promise<boolean> {
	const nextButtonSelector = config.listing.pagination?.next_button_selector;

	if (!nextButtonSelector) {
		return false;
	}

	return retryPagination(page, config, nextButtonSelector);
}
