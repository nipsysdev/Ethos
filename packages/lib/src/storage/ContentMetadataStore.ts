import type Database from "better-sqlite3";
import type { CrawledData } from "@/core/types.js";
import {
	MetadataDatabase,
	type MetadataStoreOptions,
} from "./MetadataDatabase.js";

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
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
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

/**
 * Handles content metadata operations - storing, querying, and retrieving crawled content.
 */
export class ContentMetadataStore extends MetadataDatabase {
	// Prepared statements for performance
	private insertStmt!: Database.Statement;
	private existsByUrlStmt!: Database.Statement;
	private existsByHashStmt!: Database.Statement;
	private getByHashStmt!: Database.Statement;
	private getBySourceStmt!: Database.Statement;
	private countBySourceStmt!: Database.Statement;

	constructor(options: MetadataStoreOptions = {}) {
		super(options);
		this.prepareStatements();
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
	}

	/**
	 * Store metadata for crawled content
	 */
	async store(data: CrawledData, hash: string): Promise<ContentMetadata> {
		try {
			// Parse published date if present and validate it
			let publishedDate: Date | null = null;
			if (data.publishedDate) {
				publishedDate = new Date(data.publishedDate);
				// Check if date is valid
				if (Number.isNaN(publishedDate.getTime())) {
					throw new Error(`Invalid date format: ${data.publishedDate}`);
				}
			}

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
	 * Check if multiple URLs exist in the database. Returns a Set of existing URLs.
	 * This is much more efficient than calling existsByUrl() in a loop.
	 */
	getExistingUrls(urls: string[]): Set<string> {
		if (urls.length === 0) return new Set();

		// SQLite has a limit on the number of parameters in a query (usually 999)
		// So we'll batch the queries if needed
		const BATCH_SIZE = 900;
		const existingUrls = new Set<string>();

		for (let i = 0; i < urls.length; i += BATCH_SIZE) {
			const batch = urls.slice(i, i + BATCH_SIZE);
			const placeholders = batch.map(() => "?").join(",");

			const stmt = this.db.prepare(`
				SELECT url FROM crawled_content WHERE url IN (${placeholders})
			`);

			const rows = stmt.all(...batch) as Array<{ url: string }>;
			for (const row of rows) {
				existingUrls.add(row.url);
			}
		}

		return existingUrls;
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
}
