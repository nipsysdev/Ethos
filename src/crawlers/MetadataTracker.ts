import { buildCrawlSummary } from "@/cli/utils/summaryBuilder.js";
import type {
	ContentSessionLinker,
	CrawledData,
	CrawlMetadata,
	CrawlResult,
	FieldConfig,
	SourceConfig,
} from "@/core/types.js";
import { MetadataStore } from "@/storage/MetadataStore.js";
import { CrawlErrorManager } from "./CrawlErrorManager.js";

/**
 * Handles metadata tracking and session management for crawl operations.
 * Uses SQLite database instead of temporary files for better persistence and concurrency.
 */
export class MetadataTracker implements ContentSessionLinker {
	private metadata: CrawlMetadata;
	private sessionId: string;
	private metadataStore: MetadataStore;
	private errorManager: CrawlErrorManager;
	private contentLinkedCount = 0;

	constructor(
		config: SourceConfig,
		startTime: Date,
		metadataStore?: MetadataStore,
	) {
		// Create epoch timestamp-based session ID
		const epochTimestamp = Math.floor(startTime.getTime() / 1000);
		this.sessionId = `crawl-session-${epochTimestamp}`;
		console.log(`Starting crawl session: ${this.sessionId}`);

		// Initialize metadata store (use provided one for testing, or create new one)
		this.metadataStore = metadataStore ?? new MetadataStore();

		this.errorManager = new CrawlErrorManager(
			this.metadataStore,
			this.sessionId,
		);

		this.metadata = {
			duplicatesSkipped: 0,
			urlsExcluded: 0,
			totalFilteredItems: 0,
			itemsProcessed: 0,
			pagesProcessed: 0,
			contentsCrawled: 0,
			fieldStats: Object.entries(config.listing.items.fields).map(
				([fieldName, fieldConfig]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: (fieldConfig as FieldConfig).optional || false,
					missingItems: [],
				}),
			),
			contentFieldStats: Object.entries(config.content.fields).map(
				([fieldName]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: true,
					missingItems: [],
				}),
			),
			// Don't initialize error arrays - errors are stored directly in database
			listingErrors: [],
			contentErrors: [],
		};

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
				`Failed to create crawl session (sessionId: ${this.sessionId}, sourceId: ${config.id}, sourceName: ${config.name}): ${error instanceof Error ? error.message : error}`,
			);
			throw error;
		}
	}

	getMetadata(): CrawlMetadata {
		return this.metadata;
	}

	getSessionId(): string {
		return this.sessionId;
	}

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

	addItems(items: CrawledData[]): void {
		this.metadata.itemsProcessed += items.length;

		this.updateSessionInDatabase();
	}

	linkContentToSession(
		contentId: number,
		hadContentExtractionError = false,
	): void {
		// Increment and use the counter for proper ordering
		this.contentLinkedCount++;
		this.metadataStore.linkContentToSession(
			this.sessionId,
			contentId,
			this.contentLinkedCount,
			hadContentExtractionError,
		);
	}

	incrementPagesProcessed(): void {
		this.metadata.pagesProcessed++;
		this.updateSessionInDatabase();
	}

	addDuplicatesSkipped(count: number): void {
		this.metadata.duplicatesSkipped += count;
		this.updateSessionInDatabase();
	}

	addUrlsExcluded(count: number): void {
		this.metadata.urlsExcluded += count;
		// Also increment total filtered items count for accurate totals
		this.metadata.totalFilteredItems += count;
		this.updateSessionInDatabase();
	}

	/**
	 * Remove field statistics for excluded URLs to prevent them from affecting required field error counts
	 */
	removeFieldStatsForExcludedUrls(
		excludedCount: number,
		excludedItemIndices: number[],
	): void {
		// Reduce the total attempts count for each field by the number of excluded URLs
		this.metadata.fieldStats.forEach((stat) => {
			if (stat.totalAttempts >= excludedCount) {
				stat.totalAttempts -= excludedCount;

				// Remove specific excluded item indices from missingItems
				// Convert to absolute indices based on current item offset
				const absoluteExcludedIndices = new Set(excludedItemIndices);
				stat.missingItems = stat.missingItems.filter(
					(itemIndex) => !absoluteExcludedIndices.has(itemIndex),
				);
			}
		});
		this.updateSessionInDatabase();
	}

	addFilteredItems(count: number, reasons: string[]): void {
		this.metadata.totalFilteredItems += count;
		// Use error manager for consistent error handling
		this.errorManager.addListingErrors(reasons);
		// Update the session to reflect the new totalFilteredItems count
		this.updateSessionMetadataField(
			"totalFilteredItems",
			this.metadata.totalFilteredItems,
		);
	}

	addContentErrors(errors: string[]): void {
		// Use error manager for consistent error handling
		this.errorManager.addContentErrors(errors);
	}

	/**
	 * Track field extraction warnings (for optional fields and non-fatal issues)
	 */
	addFieldExtractionWarnings(warnings: string[]): void {
		// Use error manager with automatic categorization
		this.errorManager.addFieldExtractionWarnings(warnings);
	}

	addContentsCrawled(count: number): void {
		this.metadata.contentsCrawled += count;
		this.updateSessionMetadataField(
			"contentsCrawled",
			this.metadata.contentsCrawled,
		);
	}

	setStoppedReason(
		reason:
			| "max_pages"
			| "no_next_button"
			| "all_duplicates"
			| "process_interrupted",
	): void {
		this.metadata.stoppedReason = reason;
		this.updateSessionMetadataField(
			"stoppedReason",
			this.metadata.stoppedReason,
		);
	}

	/**
	 * Build the final crawl result from tracked metadata
	 */
	buildCrawlResult(): CrawlResult {
		// Get session data from database for summary
		const session = this.metadataStore.getSession(this.sessionId);
		if (!session) {
			throw new Error(`Session not found: ${this.sessionId}`);
		}

		// Get errors from the error manager (which retrieves from database)
		const { listingErrors, contentErrors } =
			this.errorManager.getSessionErrors();

		// Merge database errors with current metadata for summary generation
		const metadataWithErrors = {
			...this.metadata,
			listingErrors,
			contentErrors,
		};

		// Calculate actual items with content extraction errors (not just error message count)
		// This ensures consistency between fresh crawls and session reconstruction
		const sessionContents = this.metadataStore.getSessionContents(
			this.sessionId,
		);
		const actualItemsWithErrors = sessionContents.filter(
			(content) => content.hadContentExtractionError,
		).length;

		// End the session as crawling is complete
		this.metadataStore.endSession(this.sessionId);

		const summary = buildCrawlSummary(
			{
				sourceId: session.sourceId,
				sourceName: session.sourceName,
				startTime: session.startTime,
				endTime: new Date(),
				sessionId: this.sessionId,
			},
			metadataWithErrors, // Use metadata with errors from database
			{ itemsWithErrors: actualItemsWithErrors }, // Override with actual item error count
		);

		// Return empty data array since all items were processed immediately
		// The actual data was stored via onPageComplete callback
		return {
			data: [], // Empty since items were processed and stored immediately
			summary,
		};
	}

	private updateSessionInDatabase(): void {
		try {
			// Get current session to preserve existing errors
			const session = this.metadataStore.getSession(this.sessionId);
			if (!session) {
				this.metadataStore.updateSession(this.sessionId, this.metadata);
				return;
			}

			// Get errors from error manager and merge with current metadata
			const { listingErrors, contentErrors } =
				this.errorManager.getSessionErrors();
			const mergedMetadata = {
				...this.metadata,
				listingErrors,
				contentErrors,
			};

			this.metadataStore.updateSession(this.sessionId, mergedMetadata);
		} catch (error) {
			console.error(
				`Failed to update session metadata (sessionId: ${this.sessionId}): ${error instanceof Error ? error.message : error}`,
			);
			// Intentionally do not re-throw the error: this method runs as a background operation,
			// and any failure to update session metadata should not interrupt or break the main crawling process.
		}
	}

	/**
	 * Update a specific field in session metadata without overwriting errors
	 */
	private updateSessionMetadataField<K extends keyof CrawlMetadata>(
		fieldName: K,
		value: CrawlMetadata[K],
	): void {
		try {
			// Get current session to preserve existing data including errors
			const session = this.metadataStore.getSession(this.sessionId);
			if (!session) {
				throw new Error(`Session not found: ${this.sessionId}`);
			}

			// Parse current metadata to preserve errors
			const currentMetadata = JSON.parse(session.metadata);

			currentMetadata[fieldName] = value;

			this.metadataStore.updateSession(this.sessionId, currentMetadata);
		} catch (error) {
			console.error(
				`Failed to update session metadata field ${String(fieldName)} (sessionId: ${this.sessionId}): ${error instanceof Error ? error.message : error}`,
			);
		}
	}
}
