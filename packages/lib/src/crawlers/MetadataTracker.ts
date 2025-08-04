import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	CrawledData,
	CrawlMetadata,
	CrawlResult,
	CrawlSummary,
	SourceConfig,
} from "@/core/types.js";
import { generateContentHash } from "@/utils/hash.js";

/**
 * Handles metadata tracking and temporary file management for crawl operations.
 * Separated from the main crawler to improve separation of concerns.
 */
export class MetadataTracker {
	private metadata: CrawlMetadata;
	private tempFile: string;

	constructor(config: SourceConfig, startTime: Date) {
		// Create temporary file for tracking crawl metadata
		this.tempFile = join(
			tmpdir(),
			`ethos-crawl-${Date.now()}-${randomUUID()}.json`,
		);
		console.log(`📝 Using temporary metadata file: ${this.tempFile}`);

		// Register temp file for cleanup (if running in CLI context)
		this.registerTempFile();

		// Initialize crawl metadata
		this.metadata = {
			sourceId: config.id,
			sourceName: config.name,
			startTime,
			itemUrls: [],
			itemsForViewer: [],
			duplicatesSkipped: 0,
			totalFilteredItems: 0,
			pagesProcessed: 0,
			detailsCrawled: 0,
			fieldStats: Object.entries(config.listing.items.fields).map(
				([fieldName, fieldConfig]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: fieldConfig.optional || false,
					missingItems: [],
				}),
			),
			detailFieldStats: Object.entries(config.detail.fields).map(
				([fieldName]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: true,
					missingItems: [],
				}),
			),
			listingErrors: [],
			detailErrors: [],
		};
	}

	/**
	 * Register temp file for cleanup (if running in CLI context)
	 */
	private async registerTempFile(): Promise<void> {
		try {
			const { registerTempFile } = await import("@/cli/index.js");
			registerTempFile(this.tempFile);
		} catch {
			// Not in CLI context, ignore
		}
	}

	/**
	 * Get current metadata state
	 */
	getMetadata(): CrawlMetadata {
		return this.metadata;
	}

	/**
	 * Get the temporary file path
	 */
	getTempFilePath(): string {
		return this.tempFile;
	}

	/**
	 * Add new items to tracking and update the temp file
	 */
	addItems(items: CrawledData[]): void {
		for (const item of items) {
			this.metadata.itemUrls.push(item.url);

			// Generate hash for viewer access
			const hash = this.generateHash(item.url);
			this.metadata.itemsForViewer.push({
				url: item.url,
				title: item.title,
				hash,
				publishedDate: item.publishedDate,
			});
		}

		this.writeMetadataToFile();
	}

	/**
	 * Track that a page has been processed
	 */
	incrementPagesProcessed(): void {
		this.metadata.pagesProcessed++;
	}

	/**
	 * Track duplicates that were skipped
	 */
	addDuplicatesSkipped(count: number): void {
		this.metadata.duplicatesSkipped += count;
	}

	/**
	 * Track filtered items
	 */
	addFilteredItems(count: number, reasons: string[]): void {
		this.metadata.totalFilteredItems += count;
		this.metadata.listingErrors.push(...reasons);
	}

	/**
	 * Track that detail data was crawled
	 */
	addDetailsCrawled(count: number): void {
		this.metadata.detailsCrawled += count;
	}

	/**
	 * Set the reason why crawling stopped
	 */
	setStoppedReason(
		reason: "max_pages" | "no_next_button" | "all_duplicates",
	): void {
		this.metadata.stoppedReason = reason;
	}

	/**
	 * Build the final crawl result from tracked metadata
	 */
	buildCrawlResult(): CrawlResult {
		// Sort items by published date (newest first) for viewer display
		this.metadata.itemsForViewer.sort((a, b) => {
			// Handle cases where publishedDate might be undefined
			const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
			const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;

			// Sort newest first (descending order)
			return dateB - dateA;
		});

		// Update the metadata file with sorted items
		this.writeMetadataToFile();

		const endTime = new Date();
		const summary: CrawlSummary = {
			sourceId: this.metadata.sourceId,
			sourceName: this.metadata.sourceName,
			itemsFound:
				this.metadata.itemUrls.length +
				this.metadata.duplicatesSkipped +
				this.metadata.totalFilteredItems,
			itemsProcessed: this.metadata.itemUrls.length,
			itemsWithErrors: this.metadata.totalFilteredItems,
			fieldStats: this.metadata.fieldStats,
			detailFieldStats: this.metadata.detailFieldStats,
			listingErrors: this.metadata.listingErrors,
			startTime: this.metadata.startTime,
			endTime,
			pagesProcessed: this.metadata.pagesProcessed,
			duplicatesSkipped: this.metadata.duplicatesSkipped,
			stoppedReason: this.metadata.stoppedReason,
			detailsCrawled: this.metadata.detailsCrawled,
			detailErrors: this.metadata.detailErrors,
		};

		// Return empty data array since all items were processed immediately
		// The actual data was stored via onPageComplete callback
		return {
			data: [], // Empty since items were processed and stored immediately
			summary: {
				...summary,
				// Include temp file path for viewer to access crawl metadata
				tempMetadataFile: this.tempFile,
			},
		};
	}

	/**
	 * Write current metadata to the temporary file
	 */
	private writeMetadataToFile(): void {
		writeFileSync(this.tempFile, JSON.stringify(this.metadata, null, 2));
	}

	/**
	 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
	 * This matches the ContentStore implementation for consistent hashing
	 */
	private generateHash(content: string): string {
		return generateContentHash(content);
	}
}
