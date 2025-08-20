import type {
	ContentSessionLinker,
	CrawledData,
	CrawlMetadata,
	CrawlResult,
	FieldConfig,
	SourceConfig,
} from "@/core/types";
import { createCrawlErrorManager } from "@/crawlers/CrawlErrorManager";
import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore";
import { getStoragePath } from "@/utils/storagePath.js";
import { buildCrawlSummary } from "@/utils/summaryBuilder";

export enum MetadataActionType {
	ADD_ITEMS = "ADD_ITEMS",
	INCREMENT_PAGES_PROCESSED = "INCREMENT_PAGES_PROCESSED",
	ADD_DUPLICATES_SKIPPED = "ADD_DUPLICATES_SKIPPED",
	ADD_URLS_EXCLUDED = "ADD_URLS_EXCLUDED",
	REMOVE_FIELD_STATS_FOR_EXCLUDED_URLS = "REMOVE_FIELD_STATS_FOR_EXCLUDED_URLS",
	ADD_FILTERED_ITEMS = "ADD_FILTERED_ITEMS",
	ADD_CONTENTS_CRAWLED = "ADD_CONTENTS_CRAWLED",
	SET_STOPPED_REASON = "SET_STOPPED_REASON",
	LINK_CONTENT_TO_SESSION = "LINK_CONTENT_TO_SESSION",
}

export enum StoppedReason {
	MAX_PAGES = "max_pages",
	NO_NEXT_BUTTON = "no_next_button",
	ALL_DUPLICATES = "all_duplicates",
	PROCESS_INTERRUPTED = "process_interrupted",
}

export interface MetadataState {
	readonly sessionId: string;
	readonly metadata: CrawlMetadata;
	readonly contentLinkedCount: number;
}

export type MetadataAction =
	| { type: MetadataActionType.ADD_ITEMS; count: number }
	| { type: MetadataActionType.INCREMENT_PAGES_PROCESSED }
	| { type: MetadataActionType.ADD_DUPLICATES_SKIPPED; count: number }
	| { type: MetadataActionType.ADD_URLS_EXCLUDED; count: number }
	| {
			type: MetadataActionType.REMOVE_FIELD_STATS_FOR_EXCLUDED_URLS;
			excludedCount: number;
			excludedItemIndices: number[];
	  }
	| { type: MetadataActionType.ADD_FILTERED_ITEMS; count: number }
	| { type: MetadataActionType.ADD_CONTENTS_CRAWLED; count: number }
	| {
			type: MetadataActionType.SET_STOPPED_REASON;
			reason: StoppedReason;
	  }
	| { type: MetadataActionType.LINK_CONTENT_TO_SESSION };

function metadataReducer(
	state: MetadataState,
	action: MetadataAction,
): MetadataState {
	switch (action.type) {
		case MetadataActionType.ADD_ITEMS:
			return {
				...state,
				metadata: {
					...state.metadata,
					itemsProcessed: state.metadata.itemsProcessed + action.count,
				},
			};

		case MetadataActionType.INCREMENT_PAGES_PROCESSED:
			return {
				...state,
				metadata: {
					...state.metadata,
					pagesProcessed: state.metadata.pagesProcessed + 1,
				},
			};

		case MetadataActionType.ADD_DUPLICATES_SKIPPED:
			return {
				...state,
				metadata: {
					...state.metadata,
					duplicatesSkipped: state.metadata.duplicatesSkipped + action.count,
				},
			};

		case MetadataActionType.ADD_URLS_EXCLUDED:
			return {
				...state,
				metadata: {
					...state.metadata,
					urlsExcluded: state.metadata.urlsExcluded + action.count,
					totalFilteredItems: state.metadata.totalFilteredItems + action.count,
				},
			};

		case MetadataActionType.REMOVE_FIELD_STATS_FOR_EXCLUDED_URLS:
			return {
				...state,
				metadata: {
					...state.metadata,
					fieldStats: state.metadata.fieldStats.map((stat) => {
						if (stat.totalAttempts >= action.excludedCount) {
							const absoluteExcludedIndices = new Set(
								action.excludedItemIndices,
							);
							return {
								...stat,
								totalAttempts: stat.totalAttempts - action.excludedCount,
								missingItems: stat.missingItems.filter(
									(itemIndex) => !absoluteExcludedIndices.has(itemIndex),
								),
							};
						}
						return stat;
					}),
				},
			};

		case MetadataActionType.ADD_FILTERED_ITEMS:
			return {
				...state,
				metadata: {
					...state.metadata,
					totalFilteredItems: state.metadata.totalFilteredItems + action.count,
				},
			};

		case MetadataActionType.ADD_CONTENTS_CRAWLED:
			return {
				...state,
				metadata: {
					...state.metadata,
					contentsCrawled: state.metadata.contentsCrawled + action.count,
				},
			};

		case MetadataActionType.SET_STOPPED_REASON:
			return {
				...state,
				metadata: {
					...state.metadata,
					stoppedReason: action.reason,
				},
			};

		case MetadataActionType.LINK_CONTENT_TO_SESSION:
			return {
				...state,
				contentLinkedCount: state.contentLinkedCount + 1,
			};

		default:
			return state;
	}
}

function createInitialMetadata(
	config: SourceConfig,
	sessionId: string,
): MetadataState {
	return {
		sessionId,
		contentLinkedCount: 0,
		metadata: {
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
			listingErrors: [],
			contentErrors: [],
		},
	};
}

function createSessionId(startTime: Date): string {
	const epochTimestamp = Math.floor(startTime.getTime() / 1000);
	return `crawl-session-${epochTimestamp}`;
}

export interface MetadataTracker extends ContentSessionLinker {
	getMetadata(): CrawlMetadata;
	getSessionId(): string;
	getMetadataStore(): MetadataStore;
	checkpoint(): void;
	addItems(items: CrawledData[]): void;
	linkContentToSession(
		contentId: number,
		hadContentExtractionError?: boolean,
	): void;
	incrementPagesProcessed(): void;
	addDuplicatesSkipped(count: number): void;
	addUrlsExcluded(count: number): void;
	removeFieldStatsForExcludedUrls(
		excludedCount: number,
		excludedItemIndices: number[],
	): void;
	addFilteredItems(count: number, reasons: string[]): void;
	addContentErrors(errors: string[]): void;
	addFieldExtractionWarnings(warnings: string[]): void;
	addContentsCrawled(count: number): void;
	setStoppedReason(reason: StoppedReason): void;
	buildCrawlResult(): CrawlResult;
}

export function createMetadataTracker(
	config: SourceConfig,
	startTime: Date,
	metadataStore?: MetadataStore,
): MetadataTracker {
	const sessionId = createSessionId(startTime);
	console.log(`Starting crawl session: ${sessionId}`);

	const store = metadataStore ?? createMetadataStore(getStoragePath());
	const errorManager = createCrawlErrorManager(store, sessionId);

	let state = createInitialMetadata(config, sessionId);

	try {
		store.createSession(
			sessionId,
			config.id,
			config.name,
			startTime,
			state.metadata,
		);
	} catch (error) {
		console.error(
			`Failed to create crawl session (sessionId: ${sessionId}, sourceId: ${config.id}, sourceName: ${config.name}): ${error instanceof Error ? error.message : error}`,
		);
		throw error;
	}

	function updateState(action: MetadataAction): void {
		state = metadataReducer(state, action);
		updateSessionInDatabase();
	}

	function updateSessionInDatabase(): void {
		try {
			const session = store.getSession(sessionId);
			if (!session) {
				store.updateSession(sessionId, state.metadata);
				return;
			}

			const { listingErrors, contentErrors } = errorManager.getSessionErrors();
			const mergedMetadata = {
				...state.metadata,
				listingErrors,
				contentErrors,
			};

			store.updateSession(sessionId, mergedMetadata);
		} catch (error) {
			console.error(
				`Failed to update session metadata (sessionId: ${sessionId}): ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	function updateSessionMetadataField<K extends keyof CrawlMetadata>(
		fieldName: K,
		value: CrawlMetadata[K],
	): void {
		try {
			const session = store.getSession(sessionId);
			if (!session) {
				throw new Error(`Session not found: ${sessionId}`);
			}

			const currentMetadata = JSON.parse(session.metadata);
			currentMetadata[fieldName] = value;

			store.updateSession(sessionId, currentMetadata);
		} catch (error) {
			console.error(
				`Failed to update session metadata field ${String(fieldName)} (sessionId: ${sessionId}): ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	return {
		getMetadata(): CrawlMetadata {
			return state.metadata;
		},

		getSessionId(): string {
			return state.sessionId;
		},

		getMetadataStore(): MetadataStore {
			return store;
		},

		checkpoint(): void {
			store.checkpoint();
		},

		addItems(items: CrawledData[]): void {
			updateState({ type: MetadataActionType.ADD_ITEMS, count: items.length });
		},

		linkContentToSession(
			contentId: number,
			hadContentExtractionError = false,
		): void {
			updateState({ type: MetadataActionType.LINK_CONTENT_TO_SESSION });
			store.linkContentToSession(
				sessionId,
				contentId,
				state.contentLinkedCount,
				hadContentExtractionError,
			);
		},

		incrementPagesProcessed(): void {
			updateState({ type: MetadataActionType.INCREMENT_PAGES_PROCESSED });
		},

		addDuplicatesSkipped(count: number): void {
			updateState({ type: MetadataActionType.ADD_DUPLICATES_SKIPPED, count });
		},

		addUrlsExcluded(count: number): void {
			updateState({ type: MetadataActionType.ADD_URLS_EXCLUDED, count });
		},

		removeFieldStatsForExcludedUrls(
			excludedCount: number,
			excludedItemIndices: number[],
		): void {
			updateState({
				type: MetadataActionType.REMOVE_FIELD_STATS_FOR_EXCLUDED_URLS,
				excludedCount,
				excludedItemIndices,
			});
		},

		addFilteredItems(count: number, reasons: string[]): void {
			updateState({ type: MetadataActionType.ADD_FILTERED_ITEMS, count });
			errorManager.addListingErrors(reasons);
			updateSessionMetadataField(
				"totalFilteredItems",
				state.metadata.totalFilteredItems,
			);
		},

		addContentErrors(errors: string[]): void {
			errorManager.addContentErrors(errors);
		},

		addFieldExtractionWarnings(warnings: string[]): void {
			errorManager.addFieldExtractionWarnings(warnings);
		},

		addContentsCrawled(count: number): void {
			updateState({ type: MetadataActionType.ADD_CONTENTS_CRAWLED, count });
			updateSessionMetadataField(
				"contentsCrawled",
				state.metadata.contentsCrawled,
			);
		},

		setStoppedReason(reason: StoppedReason): void {
			updateState({ type: MetadataActionType.SET_STOPPED_REASON, reason });
			updateSessionMetadataField("stoppedReason", state.metadata.stoppedReason);
		},

		buildCrawlResult(): CrawlResult {
			const session = store.getSession(sessionId);
			if (!session) {
				throw new Error(`Session not found: ${sessionId}`);
			}

			const { listingErrors, contentErrors } = errorManager.getSessionErrors();
			const metadataWithErrors = {
				...state.metadata,
				listingErrors,
				contentErrors,
			};

			const sessionContents = store.getSessionContents(sessionId);
			const actualItemsWithErrors = sessionContents.filter(
				(content) => content.hadContentExtractionError,
			).length;

			store.endSession(sessionId);

			const summary = buildCrawlSummary(
				{
					sourceId: session.sourceId,
					sourceName: session.sourceName,
					startTime: session.startTime,
					endTime: new Date(),
					sessionId,
				},
				metadataWithErrors,
				{ itemsWithErrors: actualItemsWithErrors },
			);

			return {
				data: [],
				summary,
			};
		},
	};
}
