import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

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

	let parsedDate = dayjs(cleaned);
	if (!parsedDate.isValid()) {
		const dateFormats = [
			"MMMM D, YYYY",
			"MMMM DD, YYYY",
			"D MMMM YYYY",
			"DD MMMM YYYY",
			"YYYY-MM-DD",
		];
		parsedDate = dayjs(cleaned, dateFormats, true);
	}

	if (parsedDate.isValid()) {
		return parsedDate.utc(parsedDate.hour() === 0).toISOString();
	}

	throw new Error(
		`Unable to parse date format: "${dateString}". Source format may have changed and requires code update.`,
	);
}
