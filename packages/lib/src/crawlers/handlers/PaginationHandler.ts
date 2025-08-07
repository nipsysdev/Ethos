import type { Page } from "puppeteer";
import type { SourceConfig } from "@/core/types.js";

// Timeout constants for pagination handling - optimized for faster crawling
const NAVIGATION_TIMEOUT_MS = 5000; // Reduced from 8000 - most sites load faster
const CONTAINER_WAIT_TIMEOUT_MS = 6000; // Reduced from 10000 - faster timeout
const CONTENT_LOAD_DELAY_MS = 1000; // Reduced from 3000 - minimal delay for content loading
const RETRY_ATTEMPTS = 2; // Reduced from 3 - fewer retries for faster failure detection
const RETRY_DELAY_MS = 1000; // Reduced from 2000 - faster retry cycles

export class PaginationHandler {
	async navigateToNextPage(page: Page, config: SourceConfig): Promise<boolean> {
		const nextButtonSelector = config.listing.pagination?.next_button_selector;

		if (!nextButtonSelector) {
			return false;
		}

		// Try multiple times with better error handling
		for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
			try {
				// Check if next button exists and is clickable
				const nextButton = await page.$(nextButtonSelector);
				if (!nextButton) {
					return false;
				}

				// Check if button is disabled or hidden
				const isDisabled = await page.evaluate((selector) => {
					const element = document.querySelector(selector);
					if (!element) return true;

					// Check various ways a button might be disabled
					const htmlElement = element as HTMLElement;
					const isHidden = htmlElement.offsetParent === null;
					const hasDisabledAttr = element.hasAttribute("disabled");
					const hasDisabledClass = element.classList.contains("disabled");
					const hasAriaDisabled =
						element.getAttribute("aria-disabled") === "true";

					return (
						isHidden || hasDisabledAttr || hasDisabledClass || hasAriaDisabled
					);
				}, nextButtonSelector);

				if (isDisabled) {
					return false;
				}

				// Click the next button
				await nextButton.click();

				// Try to wait for navigation, but don't fail if it's AJAX-based pagination
				try {
					await page.waitForNavigation({
						waitUntil: "domcontentloaded",
						timeout: NAVIGATION_TIMEOUT_MS,
					});
				} catch {
					// No navigation occurred - likely AJAX pagination, continue anyway
				}

				// Additional wait for content to load (important for timing-sensitive sites)
				await new Promise((resolve) =>
					setTimeout(resolve, CONTENT_LOAD_DELAY_MS),
				);

				// Wait for the container selector to be available (works for both navigation types)
				try {
					await page.waitForSelector(config.listing.items.container_selector, {
						timeout: CONTAINER_WAIT_TIMEOUT_MS,
					});
				} catch (_error) {
					// Container didn't load - this is a failure, retry if possible
					if (attempt < RETRY_ATTEMPTS) {
						await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
						continue;
					}
					return false;
				}

				// Container loaded successfully - this indicates successful pagination
				// regardless of whether URL changed (handles both traditional and AJAX pagination)
				return true;
			} catch (_error) {
				// If this was the last attempt, return false
				if (attempt === RETRY_ATTEMPTS) {
					return false;
				}

				// Otherwise, wait and retry
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
			}
		}

		return false;
	}
}
