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

export function parsePublishedDate(
	dateString: string | null | undefined,
): string {
	if (!dateString || typeof dateString !== "string") {
		throw new Error(
			`Invalid date input: expected non-empty string, got ${typeof dateString}: "${dateString}"`,
		);
	}

	const cleaned = dateString
		.trim()
		.replace(/^(published|posted(\s+on)?|on)\s*/i, "")
		.replace(/\s+/g, " ");

	try {
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

		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleaned)) {
			const parsed = new Date(cleaned);
			if (isValidDate(parsed)) {
				return parsed.toISOString();
			}
		}

		const fallbackDate = new Date(cleaned);
		if (isValidDate(fallbackDate)) {
			return fallbackDate.toISOString();
		}

		throw new Error(
			`Unable to parse date format: "${dateString}". Source format may have changed and requires code update.`,
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Unable to parse date format")
		) {
			throw error;
		}
		throw new Error(
			`Error parsing date "${dateString}": ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

function isValidDate(date: Date): boolean {
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	const year = date.getFullYear();
	const currentYear = new Date().getFullYear();
	return year >= 1990 && year <= currentYear + 5;
}

export function formatDateForDisplay(isoString: string): string {
	try {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) {
			return isoString;
		}

		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});
	} catch {
		return isoString;
	}
}
