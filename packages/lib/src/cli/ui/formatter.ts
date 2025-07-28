import type { CrawledData, CrawlSummary } from "../../index.js";

export function formatDataForViewing(
	data: CrawledData[],
	summary: CrawlSummary,
): string {
	const lines: string[] = [];

	// Header
	lines.push("=".repeat(80));
	lines.push(`EXTRACTED DATA - ${summary.sourceName} (${summary.sourceId})`);
	lines.push(`Crawled: ${summary.endTime.toLocaleString()}`);
	lines.push(`Items: ${data.length}`);
	lines.push("=".repeat(80));
	lines.push("");

	// Data items
	data.forEach((item, index) => {
		lines.push(`--- Item ${index + 1} of ${data.length} ---`);
		lines.push(`Title: ${item.title || "N/A"}`);
		lines.push(`URL: ${item.url || "N/A"}`);
		lines.push(`Source: ${item.source}`);

		if (item.publishedDate) {
			lines.push(`Published: ${item.publishedDate}`);
		} else {
			lines.push(`Crawled: ${item.timestamp.toLocaleString()}`);
		}

		if (item.author) {
			lines.push(`Author: ${item.author}`);
		}

		if (item.image) {
			lines.push(`Image: ${item.image}`);
		}

		lines.push(`Content: ${item.content || "N/A"}`);

		if (item.tags && item.tags.length > 0) {
			lines.push(`Tags: ${item.tags.join(", ")}`);
		}

		// Metadata
		lines.push("\nMetadata:");
		Object.entries(item.metadata).forEach(([key, value]) => {
			lines.push(`  ${key}: ${JSON.stringify(value)}`);
		});

		if (index < data.length - 1) {
			lines.push("");
			lines.push("-".repeat(40));
			lines.push("");
		}
	});

	lines.push("");
	lines.push("=".repeat(80));
	lines.push("End of data");
	lines.push("=".repeat(80));

	return lines.join("\n");
}
