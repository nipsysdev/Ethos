import type { CrawlSummary, ProcessedData, SourceConfig } from "@/core/types";

export function formatDataForViewing(
	data: ProcessedData[],
	summary: CrawlSummary,
): string {
	const lines: string[] = [];

	lines.push("=".repeat(80));
	lines.push(`EXTRACTED DATA - ${summary.sourceName} (${summary.sourceId})`);
	lines.push(`Crawled: ${summary.endTime.toLocaleString()}`);
	lines.push(`Items: ${data.length}`);
	lines.push("=".repeat(80));
	lines.push("");

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

		lines.push("\nMetadata:");
		Object.entries(item.metadata).forEach(([key, value]) => {
			lines.push(`  ${key}: ${JSON.stringify(value)}`);
		});

		if (item.storage) {
			lines.push("\nStorage:");
			lines.push(`  Hash: ${item.storage.hash}`);
			lines.push(`  File: ${item.storage.path}`);
			lines.push(`  Stored: ${item.storage.storedAt.toLocaleString()}`);
		} else {
			lines.push("\nStorage: Not stored");
		}

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

export function displaySources(sources: SourceConfig[]) {
	return sources.map((s) => `${s.id} (${s.name})`).join(", ");
}
