import type { CrawledData } from "@/core/types.js";
import {
	type ContentMetadata,
	createContentMetadataStore,
	type MetadataQueryOptions,
} from "@/storage/ContentMetadataStore";
import { createMetadataDatabase } from "@/storage/MetadataDatabase";
import {
	type CrawlSession,
	createSessionMetadataStore,
	type SessionContent,
} from "@/storage/SessionMetadataStore";

export interface MetadataStore {
	// Content operations
	store: (data: CrawledData, hash: string) => Promise<ContentMetadata>;
	existsByUrl: (url: string) => boolean;
	getExistingUrls: (urls: string[]) => Set<string>;
	existsByHash: (hash: string) => boolean;
	getByHash: (hash: string) => ContentMetadata | null;
	countQuery: (options: MetadataQueryOptions) => number;
	query: (options: MetadataQueryOptions) => ContentMetadata[];
	getBySource: (
		source: string,
		limit?: number,
		offset?: number,
	) => ContentMetadata[];
	countBySource: (source: string) => number;
	getSources: () => Array<{ source: string; count: number }>;
	deleteContentBySource: (source: string) => number;
	getContentHashesBySource: (source: string) => string[];

	// Session operations
	createSession: (
		sessionId: string,
		sourceId: string,
		sourceName: string,
		startTime: Date,
		metadata: object,
	) => CrawlSession;
	updateSession: (sessionId: string, metadata: object) => void;
	getSession: (sessionId: string) => CrawlSession | null;
	getAllSessions: () => CrawlSession[];
	isSessionActive: (sessionId: string) => boolean;
	endSession: (sessionId: string) => void;
	linkContentToSession: (
		sessionId: string,
		contentId: number,
		processedOrder: number,
		hadContentExtractionError?: boolean,
	) => void;
	getSessionContents: (sessionId: string) => Array<
		ContentMetadata & {
			processedOrder: number;
			hadContentExtractionError: boolean;
		}
	>;
	deleteSessionsBySource: (sourceId: string) => number;
	countSessionsBySource: (sourceId: string) => number;
	addSessionErrors: (
		sessionId: string,
		errorType: "listing" | "content",
		errors: string[],
	) => void;

	// Database management
	close: () => void;
	checkpoint: () => void;
	getDatabasePath: () => string;
}

export function createMetadataStore(storageDirPath: string): MetadataStore {
	const metadataDb = createMetadataDatabase(storageDirPath);
	const contentStore = createContentMetadataStore(metadataDb);
	const sessionStore = createSessionMetadataStore(metadataDb);

	return {
		store: (data: CrawledData, hash: string): Promise<ContentMetadata> =>
			contentStore.store(data, hash),

		existsByUrl: (url: string): boolean => contentStore.existsByUrl(url),

		getExistingUrls: (urls: string[]): Set<string> =>
			contentStore.getExistingUrls(urls),

		existsByHash: (hash: string): boolean => contentStore.existsByHash(hash),

		getByHash: (hash: string): ContentMetadata | null =>
			contentStore.getByHash(hash),

		countQuery: (options: MetadataQueryOptions = {}): number =>
			contentStore.countQuery(options),

		query: (options: MetadataQueryOptions = {}): ContentMetadata[] =>
			contentStore.query(options),

		getBySource: (source: string, limit = 50, offset = 0): ContentMetadata[] =>
			contentStore.getBySource(source, limit, offset),

		countBySource: (source: string): number =>
			contentStore.countBySource(source),

		getSources: (): Array<{ source: string; count: number }> =>
			contentStore.getSources(),

		// Content deletion operations
		deleteContentBySource: (source: string): number =>
			contentStore.deleteBySource(source),

		getContentHashesBySource: (source: string): string[] =>
			contentStore.getHashesBySource(source),

		// Session operations - delegate to SessionMetadataStore
		createSession: (
			sessionId: string,
			sourceId: string,
			sourceName: string,
			startTime: Date,
			metadata: object,
		): CrawlSession =>
			sessionStore.createSession(
				sessionId,
				sourceId,
				sourceName,
				startTime,
				metadata,
			),

		updateSession: (sessionId: string, metadata: object): void =>
			sessionStore.updateSession(sessionId, metadata),

		getSession: (sessionId: string): CrawlSession | null =>
			sessionStore.getSession(sessionId),

		getAllSessions: (): CrawlSession[] => sessionStore.getAllSessions(),

		isSessionActive: (sessionId: string): boolean =>
			sessionStore.isSessionActive(sessionId),

		endSession: (sessionId: string): void => sessionStore.endSession(sessionId),

		linkContentToSession: (
			sessionId: string,
			contentId: number,
			processedOrder: number,
			hadContentExtractionError = false,
		): void =>
			sessionStore.linkContentToSession(
				sessionId,
				contentId,
				processedOrder,
				hadContentExtractionError,
			),

		getSessionContents: (
			sessionId: string,
		): Array<
			ContentMetadata & {
				processedOrder: number;
				hadContentExtractionError: boolean;
			}
		> => sessionStore.getSessionContents(sessionId),

		// Session deletion operations
		deleteSessionsBySource: (sourceId: string): number =>
			sessionStore.deleteSessionsBySource(sourceId),

		countSessionsBySource: (sourceId: string): number =>
			sessionStore.countSessionsBySource(sourceId),

		addSessionErrors: (
			sessionId: string,
			errorType: "listing" | "content",
			errors: string[],
		): void => sessionStore.addSessionErrors(sessionId, errorType, errors),

		// Database management
		close: (): void => {
			contentStore.close();
			sessionStore.close();
		},

		checkpoint: (): void => {
			contentStore.checkpoint();
			sessionStore.checkpoint();
		},

		getDatabasePath: (): string => contentStore.getDatabasePath(),
	};
}

export type {
	ContentMetadata,
	CrawlSession,
	SessionContent,
	MetadataQueryOptions,
};
