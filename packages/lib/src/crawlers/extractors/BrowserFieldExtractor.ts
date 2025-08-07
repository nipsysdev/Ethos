/**
 * Contains the browser-side extraction logic that runs in page.evaluate()
 * This needs to be self-contained as it runs in the browser context
 */

/**
 * Extracts text content from an element, optionally excluding child elements
 */
export function extractTextWithExclusions(
	element: Element,
	excludeSelectors?: string[],
): string | null {
	if (excludeSelectors && excludeSelectors.length > 0) {
		const cloned = element.cloneNode(true) as Element;
		for (const selector of excludeSelectors) {
			const excludedElements = cloned.querySelectorAll(selector);
			for (const excludedElement of excludedElements) {
				excludedElement.remove();
			}
		}
		return cloned.textContent?.trim().replace(/\s+/g, " ") || null;
	} else {
		return element.textContent?.trim().replace(/\s+/g, " ") || null;
	}
}

/**
 * Extracts field value based on attribute type
 */
export function extractFieldValue(
	element: Element | null,
	fieldConfig: { attribute: string; exclude_selectors?: string[] },
): string | null {
	if (!element) return null;

	if (fieldConfig.attribute === "text") {
		return extractTextWithExclusions(element, fieldConfig.exclude_selectors);
	} else {
		return element.getAttribute(fieldConfig.attribute);
	}
}

/**
 * Main extraction function that runs in browser context
 * This function will be serialized and executed via page.evaluate()
 */
export function createBrowserExtractionFunction() {
	return (contentConfig: {
		container_selector: string;
		fields: Record<string, unknown>;
	}) => {
		// Inline helper functions (duplicated for browser context)
		function extractTextWithExclusions(
			element: Element,
			excludeSelectors?: string[],
		) {
			if (excludeSelectors && excludeSelectors.length > 0) {
				const cloned = element.cloneNode(true) as Element;
				for (const selector of excludeSelectors) {
					const excludedElements = cloned.querySelectorAll(selector);
					for (const excludedElement of excludedElements) {
						excludedElement.remove();
					}
				}
				return cloned.textContent?.trim().replace(/\s+/g, " ") || null;
			} else {
				return element.textContent?.trim().replace(/\s+/g, " ") || null;
			}
		}

		function extractFieldValue(
			element: Element | null,
			fieldConfig: { attribute: string; exclude_selectors?: string[] },
		) {
			if (!element) return null;

			if (fieldConfig.attribute === "text") {
				return extractTextWithExclusions(
					element,
					fieldConfig.exclude_selectors,
				);
			} else {
				return element.getAttribute(fieldConfig.attribute);
			}
		}

		const results: Record<string, string | null> = {};
		const extractionErrors: string[] = [];

		// Determine the container to search within
		const containerElement = document.querySelector(
			contentConfig.container_selector,
		);
		if (!containerElement) {
			extractionErrors.push(
				`Container selector "${contentConfig.container_selector}" not found`,
			);
			return { results, extractionErrors };
		}

		for (const [fieldName, fieldConfig] of Object.entries(
			contentConfig.fields,
		)) {
			try {
				const typedFieldConfig = fieldConfig as {
					selector: string;
					attribute: string;
					exclude_selectors?: string[];
				};

				// If selector is empty, use the container element itself
				// Otherwise, find the child element with the selector
				let element: Element | null;
				if (
					!typedFieldConfig.selector ||
					typedFieldConfig.selector.trim() === ""
				) {
					element = containerElement;
				} else {
					element = containerElement.querySelector(typedFieldConfig.selector);
				}

				const value = extractFieldValue(element, typedFieldConfig);
				results[fieldName] = value && value !== "" ? value : null;
			} catch (error) {
				extractionErrors.push(`Failed to extract ${fieldName}: ${error}`);
				results[fieldName] = null;
			}
		}

		return { results, extractionErrors };
	};
}
