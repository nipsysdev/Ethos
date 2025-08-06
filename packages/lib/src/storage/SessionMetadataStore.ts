import type Database from "better-sqlite3";
import type { ContentMetadata } from "./ContentMetadataStore.js";
import {
	MetadataDatabase,
	type MetadataStoreOptions,
} from "./MetadataDatabase.js";

export interface CrawlSession {
	id?: string;
	sourceId: string;
	sourceName: string;
	startTime: Date;
	endTime?: Date; // NULL = session still active
	metadata: string; // JSON serialized CrawlMetadata (without item duplicates)
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionContent {
	sessionId: string;
	contentId: number;
	processedOrder: number; // Track the order items were processed
	hadContentExtractionError?: boolean;
}

interface SessionRow {
	id: string;
	source_id: string;
	source_name: string;
	start_time: string;
	end_time: string | null;
	metadata: string;
	created_at: string;
	updated_at: string;
}

// Session content data is handled through the join query results

interface DatabaseRow {
	id: number;
	hash: string;
	source: string;
	url: string;
	title: string;
	author: string | null;
	published_date: string | null;
	crawled_at: string;
	created_at: string;
}

/**
 * Handles crawl session management and session-content relationships.
 */
export class SessionMetadataStore extends MetadataDatabase {
	// Session-related statements
	private createSessionStmt!: Database.Statement;
	private updateSessionStmt!: Database.Statement;
	private getSessionStmt!: Database.Statement;
	private getAllSessionsStmt!: Database.Statement;
	private endSessionStmt!: Database.Statement;

	// Session-content junction statements
	private linkContentToSessionStmt!: Database.Statement;
	private getSessionContentsStmt!: Database.Statement;

	constructor(options: MetadataStoreOptions = {}) {
		super(options);
		this.prepareStatements();
	}

	/**
	 * Prepare session-related statements
	 */
	private prepareStatements(): void {
		// Session statements
		this.createSessionStmt = this.db.prepare(`
			INSERT INTO crawl_sessions (id, source_id, source_name, start_time, metadata)
			VALUES (?, ?, ?, ?, ?)
		`);

		this.updateSessionStmt = this.db.prepare(`
			UPDATE crawl_sessions 
			SET metadata = ?, updated_at = CURRENT_TIMESTAMP 
			WHERE id = ?
		`);

		this.getSessionStmt = this.db.prepare(`
			SELECT * FROM crawl_sessions WHERE id = ? LIMIT 1
		`);

		this.getAllSessionsStmt = this.db.prepare(`
			SELECT * FROM crawl_sessions ORDER BY start_time DESC
		`);

		this.endSessionStmt = this.db.prepare(`
			UPDATE crawl_sessions 
			SET end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
			WHERE id = ?
		`);

		// Session-content junction statements
		this.linkContentToSessionStmt = this.db.prepare(`
			INSERT INTO session_content (session_id, content_id, processed_order, had_content_extraction_error)
			VALUES (?, ?, ?, ?)
		`);

		this.getSessionContentsStmt = this.db.prepare(`
			SELECT 
				cc.*,
				sc.processed_order,
				sc.had_content_extraction_error
			FROM session_content sc
			JOIN crawled_content cc ON sc.content_id = cc.id
			WHERE sc.session_id = ?
			ORDER BY sc.processed_order ASC
		`);
	}

	/**
	 * Create a new crawl session
	 */
	createSession(
		sessionId: string,
		sourceId: string,
		sourceName: string,
		startTime: Date,
		metadata: object,
	): CrawlSession {
		try {
			this.createSessionStmt.run(
				sessionId,
				sourceId,
				sourceName,
				startTime.toISOString(),
				JSON.stringify(metadata),
			);

			return {
				id: sessionId,
				sourceId,
				sourceName,
				startTime,
				endTime: undefined, // Session is active (not ended)
				metadata: JSON.stringify(metadata),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
		} catch (error) {
			throw new Error(
				`Failed to create crawl session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Update session metadata
	 */
	updateSession(sessionId: string, metadata: object): void {
		try {
			const result = this.updateSessionStmt.run(
				JSON.stringify(metadata),
				sessionId,
			);
			if (result.changes === 0) {
				throw new Error(`Session not found: ${sessionId}`);
			}
		} catch (error) {
			throw new Error(
				`Failed to update session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get session by ID (active or inactive)
	 */
	getSession(sessionId: string): CrawlSession | null {
		const row = this.getSessionStmt.get(sessionId) as SessionRow | undefined;
		return row ? this.mapSessionRowToSession(row) : null;
	}

	/**
	 * Get all sessions ordered by start time (newest first)
	 */
	getAllSessions(): CrawlSession[] {
		const rows = this.getAllSessionsStmt.all() as SessionRow[];
		return rows.map((row) => this.mapSessionRowToSession(row));
	}

	/**
	 * Check if a session is currently active (not ended)
	 */
	isSessionActive(sessionId: string): boolean {
		const session = this.getSession(sessionId);
		return session ? !session.endTime : false;
	}

	/**
	 * End an active session by setting end_time
	 */
	endSession(sessionId: string): void {
		try {
			this.endSessionStmt.run(sessionId);
		} catch (error) {
			throw new Error(
				`Failed to end session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Link content to a session
	 */
	linkContentToSession(
		sessionId: string,
		contentId: number,
		processedOrder: number,
		hadContentExtractionError = false,
	): void {
		try {
			// Validate that session exists
			const session = this.getSession(sessionId);
			if (!session) {
				throw new Error(`Session not found: ${sessionId}`);
			}

			this.linkContentToSessionStmt.run(
				sessionId,
				contentId,
				processedOrder,
				hadContentExtractionError ? 1 : 0,
			);
		} catch (error) {
			throw new Error(
				`Failed to link content to session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get content for a session
	 */
	getSessionContent(sessionId: string): SessionContent[] {
		try {
			const rows = this.getSessionContentsStmt.all(sessionId) as Array<{
				session_id: string;
				content_id: number;
				processed_order: number;
				had_content_extraction_error: number;
			}>;
			return rows.map((row) => ({
				sessionId: row.session_id,
				contentId: row.content_id,
				processedOrder: row.processed_order,
				hadContentExtractionError: row.had_content_extraction_error === 1,
			}));
		} catch (error) {
			throw new Error(`Failed to get session content: ${error}`);
		}
	}

	/**
	 * Get full content metadata for a session (including session-specific data)
	 */
	getSessionContents(sessionId: string): Array<
		ContentMetadata & {
			processedOrder: number;
			hadContentExtractionError: boolean;
		}
	> {
		try {
			const rows = this.getSessionContentsStmt.all(sessionId) as Array<
				DatabaseRow & {
					processed_order: number;
					had_content_extraction_error: number;
				}
			>;
			return rows.map((row) => ({
				...this.mapRowToMetadata(row),
				processedOrder: row.processed_order,
				hadContentExtractionError: row.had_content_extraction_error === 1,
			}));
		} catch (error) {
			throw new Error(`Failed to get session contents: ${error}`);
		}
	}

	/**
	 * Map database row to ContentMetadata (reused from ContentMetadataStore)
	 */
	private mapRowToMetadata(row: DatabaseRow): ContentMetadata {
		return {
			id: row.id,
			hash: row.hash,
			source: row.source,
			url: row.url,
			title: row.title,
			author: row.author ? row.author : undefined,
			publishedDate: row.published_date
				? new Date(row.published_date)
				: undefined,
			crawledAt: new Date(row.crawled_at),
			createdAt: new Date(row.created_at),
		};
	}

	/**
	 * Map session database row to CrawlSession
	 */
	private mapSessionRowToSession(row: SessionRow): CrawlSession {
		return {
			id: row.id,
			sourceId: row.source_id,
			sourceName: row.source_name,
			startTime: new Date(row.start_time),
			endTime: row.end_time ? new Date(row.end_time) : undefined,
			metadata: row.metadata,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}
}
