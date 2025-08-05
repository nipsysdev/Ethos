import type {
	ContentSessionLinker,
	CrawledData,
	CrawlMetadata,
	CrawlResult,
	CrawlSummary,
	FieldConfig,
	SourceConfig,
} from "@/core/types.js";
import { MetadataStore } from "@/storage/MetadataStore.js";

/**
 * Handles metadata tracking and session management for crawl operations.
 * Uses SQLite database instead of temporary files for better persistence and concurrency.
 */
export class MetadataTracker implements ContentSessionLinker {
	private metadata: CrawlMetadata;
	private sessionId: string;
	private metadataStore: MetadataStore;
	private contentLinkedCount = 0; // Track how many items have been linked

	constructor(config: SourceConfig, startTime: Date) {
		// Create epoch timestamp-based session ID
		const epochTimestamp = Math.floor(startTime.getTime() / 1000);
		this.sessionId = `crawl-session-${epochTimestamp}`;
		console.log(`📝 Starting crawl session: ${this.sessionId}`);

		// Initialize metadata store
		this.metadataStore = new MetadataStore();

		// Initialize crawl metadata
		this.metadata = {
			duplicatesSkipped: 0,
			totalFilteredItems: 0,
			itemsProcessed: 0,
			pagesProcessed: 0,
			detailsCrawled: 0,
			fieldStats: Object.entries(config.listing.items.fields).map(
				([fieldName, fieldConfig]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: (fieldConfig as FieldConfig).optional || false,
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
		try {
			this.metadataStore.createSession(
				this.sessionId,
				config.id,
				config.name,
				startTime,
				this.metadata,
			);
		} catch (error) {
			console.error(
				`Failed to create crawl session: ${error instanceof Error ? error.message : error}`,
			);
			throw error; // Re-throw to let the caller handle it
		}
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
	 * Get the metadata store instance for URL existence checks
	 */
	getMetadataStore(): MetadataStore {
		return this.metadataStore;
	}

	/**
	 * Checkpoint WAL files to prevent them from growing too large.
	 * Call this periodically during long crawl operations.
	 */
	checkpoint(): void {
		this.metadataStore.checkpoint();
	}

	/**
	 * Add new items to tracking and update the session in database
	 */
	addItems(items: CrawledData[]): void {
		this.metadata.itemsProcessed += items.length;
		// Note: Items are now tracked in the junction table instead of in-memory

		this.updateSessionInDatabase();
	}

	/**
	 * Link stored content to this session
	 */
	linkContentToSession(
		contentId: number,
		hadDetailExtractionError = false,
	): void {
		// Increment and use the counter for proper ordering
		this.contentLinkedCount++;
		this.metadataStore.linkContentToSession(
			this.sessionId,
			contentId,
			this.contentLinkedCount,
			hadDetailExtractionError,
		);
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
		// Note: Items are now tracked via the junction table instead of in-memory

		// Get session data from database for summary
		const session = this.metadataStore.getSession(this.sessionId);
		if (!session) {
			throw new Error(`Session not found: ${this.sessionId}`);
		}

		// End the session as crawling is complete
		this.metadataStore.endSession(this.sessionId);

		const endTime = new Date();
		const summary: CrawlSummary = {
			sourceId: session.sourceId,
			sourceName: session.sourceName,
			itemsFound:
				this.metadata.itemsProcessed +
				this.metadata.duplicatesSkipped +
				this.metadata.totalFilteredItems,
			itemsProcessed: this.metadata.itemsProcessed,
			itemsWithErrors: this.metadata.totalFilteredItems,
			fieldStats: this.metadata.fieldStats,
			detailFieldStats: this.metadata.detailFieldStats,
			listingErrors: this.metadata.listingErrors,
			startTime: session.startTime,
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
		try {
			this.metadataStore.updateSession(this.sessionId, this.metadata);
		} catch (error) {
			console.error(
				`Failed to update session metadata: ${error instanceof Error ? error.message : error}`,
			);
			// Don't throw here as this is a background operation and shouldn't break crawling
		}
	}
}
