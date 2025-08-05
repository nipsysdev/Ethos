import type { CrawledData } from "@/core/types.js";
import {
	type ContentMetadata,
	ContentMetadataStore,
	type MetadataQueryOptions,
} from "./ContentMetadataStore.js";
import type { MetadataStoreOptions } from "./MetadataDatabase.js";
import {
	type CrawlSession,
	type SessionContent,
	SessionMetadataStore,
} from "./SessionMetadataStore.js";

/**
 * Unified interface that provides both content and session metadata operations.
 * This maintains backward compatibility while keeping the implementation clean.
 * Both stores share the same database file but manage their own connections.
 */
export class MetadataStore {
	private contentStore: ContentMetadataStore;
	private sessionStore: SessionMetadataStore;

	constructor(options: MetadataStoreOptions = {}) {
		// Both stores will connect to the same database file
		this.contentStore = new ContentMetadataStore(options);
		this.sessionStore = new SessionMetadataStore(options);
	}

	// Content operations - delegate to ContentMetadataStore
	async store(data: CrawledData, hash: string): Promise<ContentMetadata> {
		return this.contentStore.store(data, hash);
	}

	existsByUrl(url: string): boolean {
		return this.contentStore.existsByUrl(url);
	}

	existsByHash(hash: string): boolean {
		return this.contentStore.existsByHash(hash);
	}

	getByHash(hash: string): ContentMetadata | null {
		return this.contentStore.getByHash(hash);
	}

	query(options: MetadataQueryOptions = {}): ContentMetadata[] {
		return this.contentStore.query(options);
	}

	getBySource(source: string, limit = 50, offset = 0): ContentMetadata[] {
		return this.contentStore.getBySource(source, limit, offset);
	}

	countBySource(source: string): number {
		return this.contentStore.countBySource(source);
	}

	getSources(): Array<{ source: string; count: number }> {
		return this.contentStore.getSources();
	}

	// Session operations - delegate to SessionMetadataStore
	createSession(
		sessionId: string,
		sourceId: string,
		sourceName: string,
		startTime: Date,
		metadata: object,
	): CrawlSession {
		return this.sessionStore.createSession(
			sessionId,
			sourceId,
			sourceName,
			startTime,
			metadata,
		);
	}

	updateSession(sessionId: string, metadata: object): void {
		this.sessionStore.updateSession(sessionId, metadata);
	}

	getActiveSession(sessionId: string): CrawlSession | null {
		return this.sessionStore.getActiveSession(sessionId);
	}

	getSession(sessionId: string): CrawlSession | null {
		return this.sessionStore.getSession(sessionId);
	}

	closeSession(sessionId: string): void {
		this.sessionStore.closeSession(sessionId);
	}

	linkContentToSession(
		sessionId: string,
		contentId: number,
		processedOrder: number,
		hadDetailExtractionError = false,
	): void {
		this.sessionStore.linkContentToSession(
			sessionId,
			contentId,
			processedOrder,
			hadDetailExtractionError,
		);
	}

	getSessionContents(sessionId: string): Array<
		ContentMetadata & {
			processedOrder: number;
			hadDetailExtractionError: boolean;
		}
	> {
		return this.sessionStore.getSessionContents(sessionId);
	}

	// Database management
	close(): void {
		this.contentStore.close();
		this.sessionStore.close();
	}

	getDatabasePath(): string {
		return this.contentStore.getDatabasePath();
	}
}

// Re-export types for convenience
export type {
	ContentMetadata,
	CrawlSession,
	SessionContent,
	MetadataQueryOptions,
	MetadataStoreOptions,
};
