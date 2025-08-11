import type { Page } from "puppeteer";
import type { SourceConfig } from "@/core/types.js";

/**
 * Timeout constants for pagination handling - optimized for faster crawling
 */
const PAGINATION_TIMEOUTS = {
	/** Maximum time to wait for page navigation (reduced for speed) */
	NAVIGATION_MS: 5000,
	/** Maximum time to wait for container selector to appear */
	CONTAINER_WAIT_MS: 6000,
	/** Delay for content loading after navigation */
	CONTENT_LOAD_DELAY_MS: 1000,
	/** Delay between retry attempts */
	RETRY_DELAY_MS: 1000,
} as const;

/**
 * Retry configuration for pagination operations
 */
const PAGINATION_RETRY = {
	/** Maximum number of retry attempts for failed pagination */
	MAX_ATTEMPTS: 2,
} as const;

export class PaginationHandler {
	async navigateToNextPage(page: Page, config: SourceConfig): Promise<boolean> {
		const nextButtonSelector = config.listing.pagination?.next_button_selector;

		if (!nextButtonSelector) {
			return false;
		}

		// Try multiple times with better error handling
		for (let attempt = 1; attempt <= PAGINATION_RETRY.MAX_ATTEMPTS; attempt++) {
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
						timeout: PAGINATION_TIMEOUTS.NAVIGATION_MS,
					});
				} catch {
					// No navigation occurred - likely AJAX pagination, continue anyway
				}

				// Additional wait for content to load (important for timing-sensitive sites)
				await new Promise((resolve) =>
					setTimeout(resolve, PAGINATION_TIMEOUTS.CONTENT_LOAD_DELAY_MS),
				);

				// Wait for the container selector to be available (works for both navigation types)
				try {
					await page.waitForSelector(config.listing.items.container_selector, {
						timeout: PAGINATION_TIMEOUTS.CONTAINER_WAIT_MS,
					});
				} catch (_error) {
					// Container didn't load - this is a failure, retry if possible
					if (attempt < PAGINATION_RETRY.MAX_ATTEMPTS) {
						await new Promise((resolve) =>
							setTimeout(resolve, PAGINATION_TIMEOUTS.RETRY_DELAY_MS),
						);
						continue;
					}
					return false;
				}

				// Container loaded successfully - this indicates successful pagination
				// regardless of whether URL changed (handles both traditional and AJAX pagination)
				return true;
			} catch (_error) {
				// If this was the last attempt, return false
				if (attempt === PAGINATION_RETRY.MAX_ATTEMPTS) {
					return false;
				}

				// Otherwise, wait and retry
				await new Promise((resolve) =>
					setTimeout(resolve, PAGINATION_TIMEOUTS.RETRY_DELAY_MS),
				);
			}
		}

		return false;
	}
}
