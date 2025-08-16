import type Database from "better-sqlite3";
import type { ContentMetadata } from "@/storage/ContentMetadataStore";
import {
	createMetadataDatabase,
	type MetadataStoreOptions,
} from "@/storage/MetadataDatabase";

export interface CrawlSession {
	id?: string;
	sourceId: string;
	sourceName: string;
	startTime: Date;
	endTime?: Date;
	metadata: string; // JSON serialized CrawlMetadata
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionContent {
	sessionId: string;
	contentId: number;
	processedOrder: number;
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

export interface SessionMetadataStore {
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
	close: () => void;
	checkpoint: () => void;
	getDatabasePath: () => string;
}

interface PreparedStatements {
	createSessionStmt: Database.Statement;
	updateSessionStmt: Database.Statement;
	getSessionStmt: Database.Statement;
	getAllSessionsStmt: Database.Statement;
	endSessionStmt: Database.Statement;
	deleteSessionsBySourceStmt: Database.Statement;
	countSessionsBySourceStmt: Database.Statement;
	linkContentToSessionStmt: Database.Statement;
	getSessionContentsStmt: Database.Statement;
}

function prepareStatements(db: Database.Database): PreparedStatements {
	// Session statements
	const createSessionStmt = db.prepare(`
		INSERT INTO crawl_sessions (id, source_id, source_name, start_time, metadata)
		VALUES (?, ?, ?, ?, ?)
	`);

	const updateSessionStmt = db.prepare(`
		UPDATE crawl_sessions 
		SET metadata = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`);

	const getSessionStmt = db.prepare(`
		SELECT * FROM crawl_sessions WHERE id = ? LIMIT 1
	`);

	const getAllSessionsStmt = db.prepare(`
		SELECT * FROM crawl_sessions ORDER BY start_time DESC
	`);

	const endSessionStmt = db.prepare(`
		UPDATE crawl_sessions 
		SET end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`);

	// Session-content junction statements
	const linkContentToSessionStmt = db.prepare(`
		INSERT INTO session_content (session_id, content_id, processed_order, had_content_extraction_error)
		VALUES (?, ?, ?, ?)
	`);

	const getSessionContentsStmt = db.prepare(`
		SELECT 
			cc.*,
			sc.processed_order,
			sc.had_content_extraction_error
		FROM session_content sc
		JOIN crawled_content cc ON sc.content_id = cc.id
		WHERE sc.session_id = ?
		ORDER BY sc.processed_order ASC
	`);

	const deleteSessionsBySourceStmt = db.prepare(`
		DELETE FROM crawl_sessions WHERE source_id = ?
	`);

	const countSessionsBySourceStmt = db.prepare(`
		SELECT COUNT(*) as count FROM crawl_sessions WHERE source_id = ?
	`);

	return {
		createSessionStmt,
		updateSessionStmt,
		getSessionStmt,
		getAllSessionsStmt,
		endSessionStmt,
		deleteSessionsBySourceStmt,
		countSessionsBySourceStmt,
		linkContentToSessionStmt,
		getSessionContentsStmt,
	};
}

export function createSessionMetadataStore(
	options: MetadataStoreOptions = {},
): SessionMetadataStore {
	const metadataDb = createMetadataDatabase(options);
	const stmts = prepareStatements(metadataDb.db);

	const mapSessionRowToSession = (row: SessionRow): CrawlSession => ({
		id: row.id,
		sourceId: row.source_id,
		sourceName: row.source_name,
		startTime: new Date(row.start_time),
		endTime: row.end_time ? new Date(row.end_time) : undefined,
		metadata: row.metadata,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
	});

	const mapRowToMetadata = (row: DatabaseRow): ContentMetadata => ({
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
	});

	return {
		createSession: (
			sessionId: string,
			sourceId: string,
			sourceName: string,
			startTime: Date,
			metadata: object,
		): CrawlSession => {
			try {
				stmts.createSessionStmt.run(
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
		},

		updateSession: (sessionId: string, metadata: object): void => {
			try {
				const result = stmts.updateSessionStmt.run(
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
		},

		getSession: (sessionId: string): CrawlSession | null => {
			const row = stmts.getSessionStmt.get(sessionId) as SessionRow | undefined;
			return row ? mapSessionRowToSession(row) : null;
		},

		getAllSessions: (): CrawlSession[] => {
			const rows = stmts.getAllSessionsStmt.all() as SessionRow[];
			return rows.map((row) => mapSessionRowToSession(row));
		},

		isSessionActive: (sessionId: string): boolean => {
			const row = stmts.getSessionStmt.get(sessionId) as SessionRow | undefined;
			const session = row ? mapSessionRowToSession(row) : null;
			return session ? !session.endTime : false;
		},

		endSession: (sessionId: string): void => {
			try {
				stmts.endSessionStmt.run(sessionId);
			} catch (error) {
				throw new Error(
					`Failed to end session: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		},

		linkContentToSession: (
			sessionId: string,
			contentId: number,
			processedOrder: number,
			hadContentExtractionError = false,
		): void => {
			try {
				const row = stmts.getSessionStmt.get(sessionId) as
					| SessionRow
					| undefined;
				const session = row ? mapSessionRowToSession(row) : null;
				if (!session) {
					throw new Error(`Session not found: ${sessionId}`);
				}

				stmts.linkContentToSessionStmt.run(
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
		},

		getSessionContents: (
			sessionId: string,
		): Array<
			ContentMetadata & {
				processedOrder: number;
				hadContentExtractionError: boolean;
			}
		> => {
			try {
				const rows = stmts.getSessionContentsStmt.all(sessionId) as Array<
					DatabaseRow & {
						processed_order: number;
						had_content_extraction_error: number;
					}
				>;
				return rows.map((row) => ({
					...mapRowToMetadata(row),
					processedOrder: row.processed_order,
					hadContentExtractionError: row.had_content_extraction_error === 1,
				}));
			} catch (error) {
				throw new Error(`Failed to get session contents: ${error}`);
			}
		},

		deleteSessionsBySource: (sourceId: string): number => {
			const result = stmts.deleteSessionsBySourceStmt.run(sourceId);
			return result.changes;
		},

		countSessionsBySource: (sourceId: string): number => {
			const result = stmts.countSessionsBySourceStmt.get(sourceId) as {
				count: number;
			};
			return result.count;
		},

		addSessionErrors: (
			sessionId: string,
			errorType: "listing" | "content",
			errors: string[],
		): void => {
			if (errors.length === 0) {
				return;
			}

			try {
				// Use a transaction to ensure atomicity
				const transaction = metadataDb.db.transaction(() => {
					// Get current session
					const row = stmts.getSessionStmt.get(sessionId) as
						| SessionRow
						| undefined;
					const session = row ? mapSessionRowToSession(row) : null;
					if (!session) {
						throw new Error(`Session not found: ${sessionId}`);
					}

					// Parse current metadata
					const metadata = JSON.parse(session.metadata);

					// Initialize error arrays if they don't exist
					if (!metadata.listingErrors) metadata.listingErrors = [];
					if (!metadata.contentErrors) metadata.contentErrors = [];

					// Add new errors
					if (errorType === "listing") {
						metadata.listingErrors.push(...errors);
					} else {
						metadata.contentErrors.push(...errors);
					}

					// Update session with new metadata using direct SQL
					const updatedMetadata = JSON.stringify(metadata);
					stmts.updateSessionStmt.run(updatedMetadata, sessionId);
				});

				transaction();
			} catch (error) {
				throw new Error(
					`Failed to add session errors: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		},

		close: () => metadataDb.close(),
		checkpoint: () => metadataDb.checkpoint(),
		getDatabasePath: () => metadataDb.getDatabasePath(),
	};
}
