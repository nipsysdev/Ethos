import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMetadataDatabase } from "@/storage/MetadataDatabase.js";

describe("MetadataDatabase", () => {
	let testDbPath: string;
	let database: ReturnType<typeof createMetadataDatabase>;

	beforeEach(() => {
		// Use a unique test database for each test
		testDbPath = join(process.cwd(), `test-metadata-db-${Date.now()}.db`);
		database = createMetadataDatabase({ dbPath: testDbPath });
	});

	afterEach(async () => {
		// Clean up test database
		database.close();
		try {
			await rm(testDbPath);
			// Also remove WAL and SHM files
			await rm(`${testDbPath}-wal`).catch(() => {});
			await rm(`${testDbPath}-shm`).catch(() => {});
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("WAL Mode Configuration", () => {
		it("should enable WAL mode on database initialization", () => {
			const db = database.db;
			const result = db.pragma("journal_mode", { simple: true });
			expect(result).toBe("wal");
		});

		it("should configure performance optimizations", () => {
			const db = database.db;

			// Check synchronous mode
			const syncMode = db.pragma("synchronous", { simple: true });
			expect(syncMode).toBe(1); // NORMAL mode

			// Check cache size
			const cacheSize = db.pragma("cache_size", { simple: true });
			expect(cacheSize).toBe(1000);

			// Check temp store
			const tempStore = db.pragma("temp_store", { simple: true });
			expect(tempStore).toBe(2); // MEMORY mode
		});
	});

	describe("Checkpoint Management", () => {
		it("should have a checkpoint method", () => {
			expect(typeof database.checkpoint).toBe("function");
		});

		it("should execute checkpoint without error", () => {
			// This should not throw
			expect(() => database.checkpoint()).not.toThrow();
		});

		it("should perform PASSIVE checkpoint when called explicitly", () => {
			const db = database.db;
			const pragmaSpy = vi.spyOn(db, "pragma");

			database.checkpoint();

			expect(pragmaSpy).toHaveBeenCalledWith("wal_checkpoint(PASSIVE)");
			pragmaSpy.mockRestore();
		});

		it("should perform TRUNCATE checkpoint on close", () => {
			const db = database.db;
			const pragmaSpy = vi.spyOn(db, "pragma");
			const closeSpy = vi.spyOn(db, "close");

			database.close();

			expect(pragmaSpy).toHaveBeenCalledWith("wal_checkpoint(TRUNCATE)");
			expect(closeSpy).toHaveBeenCalled();

			pragmaSpy.mockRestore();
			closeSpy.mockRestore();
		});

		it("should handle checkpoint errors gracefully on close", () => {
			const db = database.db;
			const pragmaSpy = vi.spyOn(db, "pragma").mockImplementation(() => {
				throw new Error("Checkpoint failed");
			});
			const closeSpy = vi.spyOn(db, "close");
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Should not throw even if checkpoint fails
			expect(() => database.close()).not.toThrow();

			expect(pragmaSpy).toHaveBeenCalledWith("wal_checkpoint(TRUNCATE)");
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to checkpoint WAL file during close (this is usually harmless):",
				"Checkpoint failed",
			);
			expect(closeSpy).toHaveBeenCalled();

			pragmaSpy.mockRestore();
			closeSpy.mockRestore();
			consoleSpy.mockRestore();
		});
	});

	describe("Database Path", () => {
		it("should return the correct database path", () => {
			expect(database.getDatabasePath()).toBe(testDbPath);
		});
	});

	describe("Schema Creation", () => {
		it("should create required tables", () => {
			const db = database.db;

			// Check if crawled_content table exists
			const contentTable = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='crawled_content'",
				)
				.get();
			expect(contentTable).toBeTruthy();

			// Check if crawl_sessions table exists
			const sessionsTable = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='crawl_sessions'",
				)
				.get();
			expect(sessionsTable).toBeTruthy();

			// Check if session_content table exists
			const sessionContentTable = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='session_content'",
				)
				.get();
			expect(sessionContentTable).toBeTruthy();
		});

		it("should create required indexes", () => {
			const db = database.db;

			// Get all indexes
			const indexes = db
				.prepare("SELECT name FROM sqlite_master WHERE type='index'")
				.all() as Array<{ name: string }>;
			const indexNames = indexes.map((idx) => idx.name);

			// Check for expected indexes
			expect(indexNames).toContain("idx_source");
			expect(indexNames).toContain("idx_crawled_at");
			expect(indexNames).toContain("idx_published_date");
			expect(indexNames).toContain("idx_hash");
			expect(indexNames).toContain("idx_url");
			expect(indexNames).toContain("idx_session_source");
			expect(indexNames).toContain("idx_session_end_time");
			expect(indexNames).toContain("idx_session_content_session");
			expect(indexNames).toContain("idx_session_content_order");
		});
	});
});
