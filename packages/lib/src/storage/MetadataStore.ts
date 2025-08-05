import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { CrawledData } from "@/core/types.js";

export interface ContentMetadata {
	id?: number;
	hash: string;
	source: string;
	url: string;
	title: string;
	author?: string;
	publishedDate?: Date;
	crawledAt: Date;
	createdAt: Date;
}

export interface CrawlSession {
	id?: string;
	sourceId: string;
	sourceName: string;
	startTime: Date;
	isActive: boolean;
	metadata: string; // JSON serialized CrawlMetadata
	createdAt: Date;
	updatedAt: Date;
}

export interface MetadataQueryOptions {
	source?: string;
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
}

export interface MetadataStoreOptions {
	dbPath?: string;
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

export class MetadataStore {
	private db: Database.Database;
	private readonly dbPath: string;

	// Prepared statements for performance
	private insertStmt!: Database.Statement;
	private existsByUrlStmt!: Database.Statement;
	private existsByHashStmt!: Database.Statement;
	private getByHashStmt!: Database.Statement;
	private getBySourceStmt!: Database.Statement;
	private countBySourceStmt!: Database.Statement;

	// Session-related statements
	private createSessionStmt!: Database.Statement;
	private updateSessionStmt!: Database.Statement;
	private getActiveSessionStmt!: Database.Statement;
	private getSessionStmt!: Database.Statement;
	private closeSessionStmt!: Database.Statement;

	constructor(options: MetadataStoreOptions = {}) {
		this.dbPath = resolve(options.dbPath ?? "./storage/metadata.db");

		// Ensure directory exists before opening database
		this.ensureDbDirectoryExists();

		this.db = new Database(this.dbPath);

		// Enable WAL mode for better concurrency
		this.db.pragma("journal_mode = WAL");

		this.initializeDatabase();
		this.prepareStatements();
	}

	/**
	 * Initialize database schema
	 */
	private initializeDatabase(): void {
		const schema = `
			CREATE TABLE IF NOT EXISTS crawled_content (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				hash TEXT NOT NULL UNIQUE,
				source TEXT NOT NULL,
				url TEXT NOT NULL UNIQUE,
				title TEXT NOT NULL,
				author TEXT,
				published_date DATETIME,
				crawled_at DATETIME NOT NULL,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS crawl_sessions (
				id TEXT PRIMARY KEY,
				source_id TEXT NOT NULL,
				source_name TEXT NOT NULL,
				start_time DATETIME NOT NULL,
				is_active INTEGER NOT NULL DEFAULT 1,
				metadata TEXT NOT NULL DEFAULT '{}',
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_source ON crawled_content(source);
			CREATE INDEX IF NOT EXISTS idx_crawled_at ON crawled_content(crawled_at);
			CREATE INDEX IF NOT EXISTS idx_published_date ON crawled_content(published_date);
			CREATE INDEX IF NOT EXISTS idx_hash ON crawled_content(hash);
			CREATE INDEX IF NOT EXISTS idx_url ON crawled_content(url);
			
			CREATE INDEX IF NOT EXISTS idx_session_source ON crawl_sessions(source_id);
			CREATE INDEX IF NOT EXISTS idx_session_active ON crawl_sessions(is_active);
		`;

		this.db.exec(schema);
	}

	/**
	 * Prepare frequently used statements
	 */
	private prepareStatements(): void {
		this.insertStmt = this.db.prepare(`
			INSERT INTO crawled_content (hash, source, url, title, author, published_date, crawled_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		this.existsByUrlStmt = this.db.prepare(`
			SELECT 1 FROM crawled_content WHERE url = ? LIMIT 1
		`);

		this.existsByHashStmt = this.db.prepare(`
			SELECT 1 FROM crawled_content WHERE hash = ? LIMIT 1
		`);

		this.getByHashStmt = this.db.prepare(`
			SELECT * FROM crawled_content WHERE hash = ? LIMIT 1
		`);

		this.getBySourceStmt = this.db.prepare(`
			SELECT * FROM crawled_content 
			WHERE source = ? 
			ORDER BY crawled_at DESC 
			LIMIT ? OFFSET ?
		`);

		this.countBySourceStmt = this.db.prepare(`
			SELECT COUNT(*) as count FROM crawled_content WHERE source = ?
		`);

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
	}

	/**
	 * Store metadata for crawled content
	 */
	async store(data: CrawledData, hash: string): Promise<ContentMetadata> {
		try {
			// Parse published date if present
			const publishedDate = data.publishedDate
				? new Date(data.publishedDate)
				: null;

			const result = this.insertStmt.run(
				hash,
				data.source,
				data.url,
				data.title,
				data.author || null,
				publishedDate ? publishedDate.toISOString() : null,
				data.timestamp.toISOString(),
			);

			return {
				id: result.lastInsertRowid as number,
				hash,
				source: data.source,
				url: data.url,
				title: data.title,
				author: data.author || undefined,
				publishedDate: publishedDate || undefined,
				crawledAt: data.timestamp,
				createdAt: new Date(),
			};
		} catch (error) {
			// Handle unique constraint violations gracefully
			if (
				error instanceof Error &&
				error.message.includes("UNIQUE constraint failed")
			) {
				if (error.message.includes("url")) {
					throw new Error(`Content with URL already exists: ${data.url}`);
				}
				if (error.message.includes("hash")) {
					throw new Error(`Content with hash already exists: ${hash}`);
				}
			}
			throw new Error(
				`Failed to store metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Check if content exists by URL
	 */
	existsByUrl(url: string): boolean {
		return this.existsByUrlStmt.get(url) !== undefined;
	}

	/**
	 * Check if content exists by hash
	 */
	existsByHash(hash: string): boolean {
		return this.existsByHashStmt.get(hash) !== undefined;
	}

	/**
	 * Get metadata by hash
	 */
	getByHash(hash: string): ContentMetadata | null {
		const row = this.getByHashStmt.get(hash) as DatabaseRow | undefined;
		return row ? this.mapRowToMetadata(row) : null;
	}

	/**
	 * Query content by various criteria
	 */
	query(options: MetadataQueryOptions = {}): ContentMetadata[] {
		let sql = "SELECT * FROM crawled_content WHERE 1=1";
		const params: (string | number)[] = [];

		if (options.source) {
			sql += " AND source = ?";
			params.push(options.source);
		}

		if (options.startDate) {
			sql += " AND crawled_at >= ?";
			params.push(options.startDate.toISOString());
		}

		if (options.endDate) {
			sql += " AND crawled_at <= ?";
			params.push(options.endDate.toISOString());
		}

		sql += " ORDER BY crawled_at DESC";

		if (options.limit) {
			sql += " LIMIT ?";
			params.push(options.limit);
		}

		if (options.offset) {
			sql += " OFFSET ?";
			params.push(options.offset);
		}

		const stmt = this.db.prepare(sql);
		const rows = stmt.all(...params) as DatabaseRow[];

		return rows.map((row) => this.mapRowToMetadata(row));
	}

	/**
	 * Get content by source with pagination
	 */
	getBySource(source: string, limit = 50, offset = 0): ContentMetadata[] {
		const rows = this.getBySourceStmt.all(
			source,
			limit,
			offset,
		) as DatabaseRow[];
		return rows.map((row) => this.mapRowToMetadata(row));
	}

	/**
	 * Count content by source
	 */
	countBySource(source: string): number {
		const result = this.countBySourceStmt.get(source) as { count: number };
		return result.count;
	}

	/**
	 * Get all sources with content counts
	 */
	getSources(): Array<{ source: string; count: number }> {
		const stmt = this.db.prepare(`
			SELECT source, COUNT(*) as count 
			FROM crawled_content 
			GROUP BY source 
			ORDER BY count DESC
		`);

		return stmt.all() as Array<{ source: string; count: number }>;
	}

	// Session Management Methods

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
	 * Map database row to ContentMetadata
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

	/**
	 * Close database connection
	 */
	close(): void {
		this.db.close();
	}

	/**
	 * Get database path
	 */
	getDatabasePath(): string {
		return this.dbPath;
	}

	/**
	 * Ensure database directory exists
	 */
	private ensureDbDirectoryExists(): void {
		const dir = dirname(this.dbPath);
		try {
			mkdirSync(dir, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code !== "EEXIST"
			) {
				throw new Error(
					`Failed to create database directory: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
	}
}
