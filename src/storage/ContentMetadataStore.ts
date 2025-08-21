import type Database from "better-sqlite3";
import type { CrawledData } from "@/core/types.js";
import type { MetadataDatabase } from "./MetadataDatabase";

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

export interface MetadataQueryOptions {
	source?: string;
	startCrawledAt?: Date;
	endCrawledAt?: Date;
	startPublishedDate?: Date;
	endPublishedDate?: Date;
	limit?: number;
	offset?: number;
	orderBy?: "crawled_at" | "published_date";
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

export interface ContentMetadataStore {
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
	deleteBySource: (source: string) => number;
	getHashesBySource: (source: string) => string[];
	close: () => void;
	checkpoint: () => void;
	getDatabasePath: () => string;
}

interface PreparedStatements {
	insertStmt: Database.Statement;
	existsByUrlStmt: Database.Statement;
	existsByHashStmt: Database.Statement;
	getByHashStmt: Database.Statement;
	getBySourceStmt: Database.Statement;
	countBySourceStmt: Database.Statement;
	deleteBySourceStmt: Database.Statement;
	getHashesBySourceStmt: Database.Statement;
}

function prepareStatements(db: Database.Database): PreparedStatements {
	return {
		insertStmt: db.prepare(`
			INSERT INTO crawled_content (hash, source, url, title, author, published_date, crawled_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`),

		existsByUrlStmt: db.prepare(`
			SELECT 1 FROM crawled_content WHERE url = ? LIMIT 1
		`),

		existsByHashStmt: db.prepare(`
			SELECT 1 FROM crawled_content WHERE hash = ? LIMIT 1
		`),

		getByHashStmt: db.prepare(`
			SELECT * FROM crawled_content WHERE hash = ? LIMIT 1
		`),

		getBySourceStmt: db.prepare(`
			SELECT * FROM crawled_content 
			WHERE source = ? 
			ORDER BY crawled_at DESC 
			LIMIT ? OFFSET ?
		`),

		countBySourceStmt: db.prepare(`
			SELECT COUNT(*) as count FROM crawled_content WHERE source = ?
		`),

		deleteBySourceStmt: db.prepare(`
			DELETE FROM crawled_content WHERE source = ?
		`),

		getHashesBySourceStmt: db.prepare(`
			SELECT hash FROM crawled_content WHERE source = ?
		`),
	};
}

export function createContentMetadataStore(
	metadataDb: MetadataDatabase,
): ContentMetadataStore {
	const stmts = prepareStatements(metadataDb.db);

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
		store: async (
			data: CrawledData,
			hash: string,
		): Promise<ContentMetadata> => {
			try {
				let publishedDate: Date | null = null;
				if (data.publishedDate) {
					publishedDate = new Date(data.publishedDate);
					if (!publishedDate || Number.isNaN(publishedDate.getTime())) {
						throw new Error(`Invalid date format: ${data.publishedDate}`);
					}
				}

				const result = stmts.insertStmt.run(
					hash,
					data.source,
					data.url,
					data.title,
					data.author || null,
					publishedDate ? publishedDate.toISOString() : null,
					data.crawledAt.toISOString(),
				);

				return {
					id: result.lastInsertRowid as number,
					hash,
					source: data.source,
					url: data.url,
					title: data.title,
					author: data.author || undefined,
					publishedDate: publishedDate || undefined,
					crawledAt: data.crawledAt,
					createdAt: new Date(),
				};
			} catch (error) {
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
		},

		existsByUrl: (url: string): boolean => {
			return stmts.existsByUrlStmt.get(url) !== undefined;
		},

		getExistingUrls: (urls: string[]): Set<string> => {
			if (urls.length === 0) return new Set();

			const BATCH_SIZE = 900;
			const existingUrls = new Set<string>();

			for (let i = 0; i < urls.length; i += BATCH_SIZE) {
				const batch = urls.slice(i, i + BATCH_SIZE);
				const placeholders = batch.map(() => "?").join(",");

				const stmt = metadataDb.db.prepare(`
					SELECT url FROM crawled_content WHERE url IN (${placeholders})
				`);

				const rows = stmt.all(...batch) as Array<{ url: string }>;
				for (const row of rows) {
					existingUrls.add(row.url);
				}
			}

			return existingUrls;
		},

		existsByHash: (hash: string): boolean => {
			return stmts.existsByHashStmt.get(hash) !== undefined;
		},

		getByHash: (hash: string): ContentMetadata | null => {
			const row = stmts.getByHashStmt.get(hash) as DatabaseRow | undefined;
			return row ? mapRowToMetadata(row) : null;
		},

		countQuery: (options: MetadataQueryOptions = {}): number => {
			let sql = "SELECT COUNT(*) as count FROM crawled_content WHERE 1=1";
			const params: (string | number)[] = [];

			if (options.source) {
				sql += " AND source = ?";
				params.push(options.source);
			}

			if (options.startCrawledAt) {
				sql += " AND crawled_at >= ?";
				params.push(options.startCrawledAt.toISOString());
			}

			if (options.endCrawledAt) {
				sql += " AND crawled_at <= ?";
				params.push(options.endCrawledAt.toISOString());
			}

			if (options.startPublishedDate) {
				sql += " AND published_date >= ?";
				params.push(options.startPublishedDate.toISOString());
			}

			if (options.endPublishedDate) {
				sql += " AND published_date <= ?";
				params.push(options.endPublishedDate.toISOString());
			}

			const stmt = metadataDb.db.prepare(sql);
			const result = stmt.get(...params) as { count: number };
			return result.count;
		},

		query: (options: MetadataQueryOptions = {}): ContentMetadata[] => {
			let sql = "SELECT * FROM crawled_content WHERE 1=1";
			const params: (string | number)[] = [];

			if (options.source) {
				sql += " AND source = ?";
				params.push(options.source);
			}

			if (options.startCrawledAt) {
				sql += " AND crawled_at >= ?";
				params.push(options.startCrawledAt.toISOString());
			}

			if (options.endCrawledAt) {
				sql += " AND crawled_at <= ?";
				params.push(options.endCrawledAt.toISOString());
			}

			if (options.startPublishedDate) {
				sql += " AND published_date >= ?";
				params.push(options.startPublishedDate.toISOString());
			}

			if (options.endPublishedDate) {
				sql += " AND published_date <= ?";
				params.push(options.endPublishedDate.toISOString());
			}

			sql += ` ORDER BY ${options.orderBy ?? "crawled_at"} DESC`;

			if (options.limit) {
				sql += " LIMIT ?";
				params.push(options.limit);
			}

			if (options.offset) {
				sql += " OFFSET ?";
				params.push(options.offset);
			}

			const stmt = metadataDb.db.prepare(sql);
			const rows = stmt.all(...params) as DatabaseRow[];

			return rows.map((row) => mapRowToMetadata(row));
		},

		getBySource: (
			source: string,
			limit = 50,
			offset = 0,
		): ContentMetadata[] => {
			const rows = stmts.getBySourceStmt.all(
				source,
				limit,
				offset,
			) as DatabaseRow[];
			return rows.map((row) => mapRowToMetadata(row));
		},

		countBySource: (source: string): number => {
			const result = stmts.countBySourceStmt.get(source) as { count: number };
			return result.count;
		},

		getSources: (): Array<{ source: string; count: number }> => {
			const stmt = metadataDb.db.prepare(`
				SELECT source, COUNT(*) as count 
				FROM crawled_content 
				GROUP BY source 
				ORDER BY count DESC
			`);

			return stmt.all() as Array<{ source: string; count: number }>;
		},

		deleteBySource: (source: string): number => {
			const result = stmts.deleteBySourceStmt.run(source);
			return result.changes;
		},

		getHashesBySource: (source: string): string[] => {
			const rows = stmts.getHashesBySourceStmt.all(source) as Array<{
				hash: string;
			}>;
			return rows.map((row) => row.hash);
		},

		close: () => metadataDb.close(),
		checkpoint: () => metadataDb.checkpoint(),
		getDatabasePath: () => metadataDb.getDatabasePath(),
	};
}
