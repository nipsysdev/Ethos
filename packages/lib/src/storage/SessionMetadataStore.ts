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
	isActive: boolean;
	metadata: string; // JSON serialized CrawlMetadata (without item duplicates)
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionContent {
	sessionId: string;
	contentId: number;
	processedOrder: number; // Track the order items were processed
	hadDetailExtractionError?: boolean;
}

interface SessionRow {
	id: string;
	source_id: string;
	source_name: string;
	start_time: string;
	is_active: number;
	metadata: string;
	created_at: string;
	updated_at: string;
}

// Note: SessionContentRow interface removed as it's not used directly
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
	private getActiveSessionStmt!: Database.Statement;
	private getSessionStmt!: Database.Statement;
	private closeSessionStmt!: Database.Statement;

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

		this.getActiveSessionStmt = this.db.prepare(`
			SELECT * FROM crawl_sessions WHERE id = ? AND is_active = 1 LIMIT 1
		`);

		this.getSessionStmt = this.db.prepare(`
			SELECT * FROM crawl_sessions WHERE id = ? LIMIT 1
		`);

		this.closeSessionStmt = this.db.prepare(`
			UPDATE crawl_sessions 
			SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
			WHERE id = ?
		`);

		// Session-content junction statements
		this.linkContentToSessionStmt = this.db.prepare(`
			INSERT INTO session_content (session_id, content_id, processed_order, had_detail_extraction_error)
			VALUES (?, ?, ?, ?)
		`);

		this.getSessionContentsStmt = this.db.prepare(`
			SELECT 
				cc.*,
				sc.processed_order,
				sc.had_detail_extraction_error
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
				isActive: true,
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
			// Validate that session exists and is active before updating
			const session = this.getActiveSession(sessionId);
			if (!session) {
				throw new Error(`Active session not found: ${sessionId}`);
			}

			this.updateSessionStmt.run(JSON.stringify(metadata), sessionId);
		} catch (error) {
			throw new Error(
				`Failed to update session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get active session by ID
	 */
	getActiveSession(sessionId: string): CrawlSession | null {
		const row = this.getActiveSessionStmt.get(sessionId) as
			| SessionRow
			| undefined;
		return row ? this.mapSessionRowToSession(row) : null;
	}

	/**
	 * Get session by ID (active or inactive)
	 */
	getSession(sessionId: string): CrawlSession | null {
		const row = this.getSessionStmt.get(sessionId) as SessionRow | undefined;
		return row ? this.mapSessionRowToSession(row) : null;
	}

	/**
	 * Close an active session
	 */
	closeSession(sessionId: string): void {
		try {
			this.closeSessionStmt.run(sessionId);
		} catch (error) {
			throw new Error(
				`Failed to close session: ${error instanceof Error ? error.message : "Unknown error"}`,
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
		hadDetailExtractionError = false,
	): void {
		try {
			// Validate that session exists and is active
			const session = this.getActiveSession(sessionId);
			if (!session) {
				throw new Error(`Active session not found: ${sessionId}`);
			}

			this.linkContentToSessionStmt.run(
				sessionId,
				contentId,
				processedOrder,
				hadDetailExtractionError ? 1 : 0,
			);
		} catch (error) {
			throw new Error(
				`Failed to link content to session: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get all content for a session in processed order
	 */
	getSessionContents(sessionId: string): Array<
		ContentMetadata & {
			processedOrder: number;
			hadDetailExtractionError: boolean;
		}
	> {
		const rows = this.getSessionContentsStmt.all(sessionId) as Array<
			DatabaseRow & {
				processed_order: number;
				had_detail_extraction_error: number | null;
			}
		>;

		return rows.map((row) => ({
			...this.mapRowToMetadata(row),
			processedOrder: row.processed_order,
			hadDetailExtractionError: row.had_detail_extraction_error === 1,
		}));
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
			isActive: row.is_active === 1,
			metadata: row.metadata,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}
}
