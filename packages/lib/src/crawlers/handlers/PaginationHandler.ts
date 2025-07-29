import type { Page } from "puppeteer";
import type { SourceConfig } from "../../core/types.js";

// Timeout constants for pagination handling
const NAVIGATION_TIMEOUT_MS = 3000; // Time to wait for page navigation
const CONTAINER_WAIT_TIMEOUT_MS = 5000; // Time to wait for container selector after navigation

export class PaginationHandler {
	async navigateToNextPage(page: Page, config: SourceConfig): Promise<boolean> {
		const nextButtonSelector = config.listing.pagination?.next_button_selector;

		if (!nextButtonSelector) {
			return false;
		}

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

			// Click the next button - handle both traditional navigation and AJAX pagination
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

			// Wait for the container selector to be available (works for both navigation types)
			// This ensures dynamic content has loaded before we try to extract items
			await page.waitForSelector(config.listing.items.container_selector, {
				timeout: CONTAINER_WAIT_TIMEOUT_MS,
			});

			return true;
		} catch {
			// Navigation failed - this is expected when we reach the last page
			// Common causes: button click fails, navigation timeout, no next page exists
			return false;
		}
	}
}
