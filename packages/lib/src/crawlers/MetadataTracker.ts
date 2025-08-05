import type {
	CrawledData,
	CrawlMetadata,
	CrawlResult,
	CrawlSummary,
	SourceConfig,
} from "@/core/types.js";
import { MetadataStore } from "@/storage/MetadataStore.js";
import { generateContentHash } from "@/utils/hash.js";

/**
 * Handles metadata tracking and session management for crawl operations.
 * Uses SQLite database instead of temporary files for better persistence and concurrency.
 */
export class MetadataTracker {
	private metadata: CrawlMetadata;
	private sessionId: string;
	private metadataStore: MetadataStore;

	constructor(config: SourceConfig, startTime: Date) {
		// Create epoch timestamp-based session ID
		const epochTimestamp = Math.floor(startTime.getTime() / 1000);
		this.sessionId = `crawl-session-${epochTimestamp}`;
		console.log(`📝 Starting crawl session: ${this.sessionId}`);

		// Initialize metadata store
		this.metadataStore = new MetadataStore();

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

		// Create session in database
		this.metadataStore.createSession(
			this.sessionId,
			config.id,
			config.name,
			startTime,
			this.metadata,
		);
	}

	/**
	 * Get current metadata state
	 */
	getMetadata(): CrawlMetadata {
		return this.metadata;
	}

	/**
	 * Get the session ID
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Add new items to tracking and update the session in database
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

		this.updateSessionInDatabase();
	}

	/**
	 * Track that a page has been processed
	 */
	incrementPagesProcessed(): void {
		this.metadata.pagesProcessed++;
		this.updateSessionInDatabase();
	}

	/**
	 * Track duplicates that were skipped
	 */
	addDuplicatesSkipped(count: number): void {
		this.metadata.duplicatesSkipped += count;
		this.updateSessionInDatabase();
	}

	/**
	 * Track filtered items
	 */
	addFilteredItems(count: number, reasons: string[]): void {
		this.metadata.totalFilteredItems += count;
		this.metadata.listingErrors.push(...reasons);
		this.updateSessionInDatabase();
	}

	/**
	 * Track that detail data was crawled
	 */
	addDetailsCrawled(count: number): void {
		this.metadata.detailsCrawled += count;
		this.updateSessionInDatabase();
	}

	/**
	 * Set the reason why crawling stopped
	 */
	setStoppedReason(
		reason: "max_pages" | "no_next_button" | "all_duplicates",
	): void {
		this.metadata.stoppedReason = reason;
		this.updateSessionInDatabase();
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

		// Close the session as crawling is complete
		this.metadataStore.closeSession(this.sessionId);

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
				// Include session ID for viewer to access crawl metadata from database
				sessionId: this.sessionId,
			},
		};
	}

	/**
	 * Update session metadata in the database
	 */
	private updateSessionInDatabase(): void {
		this.metadataStore.updateSession(this.sessionId, this.metadata);
	}

	/**
	 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
	 * This matches the ContentStore implementation for consistent hashing
	 */
	private generateHash(content: string): string {
		return generateContentHash(content);
	}
}
