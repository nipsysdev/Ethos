import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export interface MetadataStoreOptions {
	dbPath?: string;
}

export interface MetadataDatabase {
	db: Database.Database;
	dbPath: string;
	close: () => void;
	checkpoint: () => void;
	getDatabasePath: () => string;
}

function ensureDbDirectoryExists(dbPath: string): void {
	const dir = dirname(dbPath);
	try {
		mkdirSync(dir, { recursive: true });
	} catch (error) {
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

function initializeDatabase(db: Database.Database): void {
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
			had_content_extraction_error INTEGER,
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

	db.exec(schema);
}

function configureDatabase(db: Database.Database): void {
	db.pragma("journal_mode = WAL");

	db.pragma("synchronous = NORMAL");
	db.pragma("cache_size = 1000");
	db.pragma("temp_store = MEMORY");
}

export function createMetadataDatabase(
	options: MetadataStoreOptions = {},
): MetadataDatabase {
	const dbPath = resolve(options.dbPath ?? "./storage/metadata.db");

	ensureDbDirectoryExists(dbPath);

	const db = new Database(dbPath);

	configureDatabase(db);

	initializeDatabase(db);

	return {
		db,
		dbPath,
		close: () => {
			try {
				db.pragma("wal_checkpoint(TRUNCATE)");
			} catch (error) {
				console.warn(
					"Failed to checkpoint WAL file during close (this is usually harmless):",
					error instanceof Error ? error.message : error,
				);
			}
			db.close();
		},
		checkpoint: () => {
			db.pragma("wal_checkpoint(PASSIVE)");
		},
		getDatabasePath: () => dbPath,
	};
}
