import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export interface MetadataStoreOptions {
	dbPath?: string;
}

/**
 * Base database management for metadata operations.
 * Handles connection, schema, and shared utilities.
 */
export class MetadataDatabase {
	protected db: Database.Database;
	protected readonly dbPath: string;

	constructor(options: MetadataStoreOptions = {}) {
		this.dbPath = resolve(options.dbPath ?? "./storage/metadata.db");

		// Ensure directory exists before opening database
		this.ensureDbDirectoryExists();

		this.db = new Database(this.dbPath);

		// Enable WAL mode for better concurrency
		this.db.pragma("journal_mode = WAL");

		// Performance optimizations
		this.db.pragma("synchronous = NORMAL"); // Balance between performance and safety
		this.db.pragma("cache_size = 1000"); // Increase cache size
		this.db.pragma("temp_store = MEMORY"); // Store temporary tables in memory

		this.initializeDatabase();
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
				end_time DATETIME NULL,
				metadata TEXT NOT NULL DEFAULT '{}',
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS session_content (
				session_id TEXT NOT NULL,
				content_id INTEGER NOT NULL,
				processed_order INTEGER NOT NULL,
				had_detail_extraction_error INTEGER,
				PRIMARY KEY (session_id, content_id),
				FOREIGN KEY (session_id) REFERENCES crawl_sessions(id) ON DELETE CASCADE,
				FOREIGN KEY (content_id) REFERENCES crawled_content(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_source ON crawled_content(source);
			CREATE INDEX IF NOT EXISTS idx_crawled_at ON crawled_content(crawled_at);
			CREATE INDEX IF NOT EXISTS idx_published_date ON crawled_content(published_date);
			CREATE INDEX IF NOT EXISTS idx_hash ON crawled_content(hash);
			CREATE INDEX IF NOT EXISTS idx_url ON crawled_content(url);
			
			CREATE INDEX IF NOT EXISTS idx_session_source ON crawl_sessions(source_id);
			CREATE INDEX IF NOT EXISTS idx_session_end_time ON crawl_sessions(end_time);
			
			CREATE INDEX IF NOT EXISTS idx_session_content_session ON session_content(session_id);
			CREATE INDEX IF NOT EXISTS idx_session_content_order ON session_content(session_id, processed_order);
		`;

		this.db.exec(schema);
	}

	/**
	 * Close database connection
	 */
	close(): void {
		// Checkpoint WAL file before closing to merge changes back to main database
		// This prevents WAL files from growing indefinitely
		try {
			this.db.pragma("wal_checkpoint(TRUNCATE)");
		} catch (error) {
			// Log warning but don't throw - checkpoint is an optimization, not critical
			// Database integrity is maintained even if checkpoint fails
			console.warn(
				"Failed to checkpoint WAL file during close (this is usually harmless):",
				error instanceof Error ? error.message : error,
			);
		}
		this.db.close();
	}

	/**
	 * Manually checkpoint WAL file to merge changes back to main database.
	 * Call this periodically during long-running operations to prevent
	 * WAL files from growing too large.
	 */
	checkpoint(): void {
		this.db.pragma("wal_checkpoint(PASSIVE)");
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
