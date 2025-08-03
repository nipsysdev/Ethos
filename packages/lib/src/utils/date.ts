/**
 * Date parsing utilities for handling various date formats from crawled content
 */

// Month name to zero-based index mapping for consistent date parsing
const MONTH_MAP: Record<string, number> = {
	january: 0,
	february: 1,
	march: 2,
	april: 3,
	may: 4,
	june: 5,
	july: 6,
	august: 7,
	september: 8,
	october: 9,
	november: 10,
	december: 11,
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

/**
 * Attempts to parse a date string from various formats commonly found in web content
 * Returns ISO 8601 string (same as Date.toISOString())
 * Throws error if the date cannot be parsed - this indicates source format changes
 *
 * Handles formats like:
 * - "July 10, 2025"
 * - "May 30, 2025"
 * - "2025-07-10"
 * - "10/07/2025"
 * - And other common variations
 */
export function parsePublishedDate(
	dateString: string | null | undefined,
): string {
	if (!dateString || typeof dateString !== "string") {
		throw new Error(
			`Invalid date input: expected non-empty string, got ${typeof dateString}: "${dateString}"`,
		);
	}

	// Clean up the string - remove extra whitespace and common prefixes
	const cleaned = dateString
		.trim()
		.replace(/^(published|posted|on)\s*/i, "")
		.replace(/\s+/g, " ");

	try {
		// For "Month DD, YYYY" format, parse explicitly as UTC to avoid timezone issues
		const monthDayYear = cleaned.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/);
		if (monthDayYear) {
			const [, monthName, day, year] = monthDayYear;

			const monthIndex = MONTH_MAP[monthName.toLowerCase()];
			if (monthIndex !== undefined) {
				const parsed = new Date(
					Date.UTC(parseInt(year), monthIndex, parseInt(day)),
				);
				if (isValidDate(parsed)) {
					return parsed.toISOString();
				}
			}
		}

		// For "DD Month YYYY" format
		const dayMonthYear = cleaned.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
		if (dayMonthYear) {
			const [, day, monthName, year] = dayMonthYear;

			const monthIndex = MONTH_MAP[monthName.toLowerCase()];
			if (monthIndex !== undefined) {
				const parsed = new Date(
					Date.UTC(parseInt(year), monthIndex, parseInt(day)),
				);
				if (isValidDate(parsed)) {
					return parsed.toISOString();
				}
			}
		}

		// For ISO format or other standard formats that Date can handle directly
		const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
		if (isoMatch) {
			const [, year, month, day] = isoMatch;
			const parsed = new Date(
				Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)),
			);
			if (isValidDate(parsed)) {
				return parsed.toISOString();
			}
		}

		// Handle full ISO datetime formats (with or without timezone)
		// Examples: "2025-07-25T12:00:00-07:00", "2025-07-25T12:00:00Z", "2025-07-25T12:00:00.000Z"
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleaned)) {
			const parsed = new Date(cleaned);
			if (isValidDate(parsed)) {
				return parsed.toISOString();
			}
		}

		// If all else fails, try parsing as-is but be explicit about UTC
		const fallbackDate = new Date(cleaned + " UTC");
		if (isValidDate(fallbackDate)) {
			return fallbackDate.toISOString();
		}

		// If all parsing attempts fail, throw error - source format has likely changed
		throw new Error(
			`Unable to parse date format: "${dateString}". Source format may have changed and requires code update.`,
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Unable to parse date format")
		) {
			throw error; // Re-throw our custom parsing errors
		}
		throw new Error(
			`Error parsing date "${dateString}": ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Checks if a Date object represents a valid, reasonable date
 */
function isValidDate(date: Date): boolean {
	// Check if it's a valid date object
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	// Check if it's within a reasonable range (not too far in past/future)
	const year = date.getFullYear();
	const currentYear = new Date().getFullYear();

	// Allow dates from 1990 to 5 years in the future
	return year >= 1990 && year <= currentYear + 5;
}

/**
 * Formats a date for display purposes (keeps original behavior for UI)
 */
export function formatDateForDisplay(isoString: string): string {
	try {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) {
			return isoString; // Return original if invalid
		}
		// Use UTC methods to avoid timezone conversion issues
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});
	} catch {
		return isoString; // Fallback to original
	}
}
