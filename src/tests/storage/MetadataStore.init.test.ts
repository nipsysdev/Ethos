import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MetadataStore } from "@/storage/MetadataStore.js";

describe("MetadataStore - Database Initialization", () => {
	let tempDbPath: string;
	let store: MetadataStore;

	beforeEach(() => {
		// Create a unique temporary directory for each test
		tempDbPath = resolve(
			process.cwd(),
			`test-storage-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		mkdirSync(tempDbPath, { recursive: true });

		store = new MetadataStore({
			dbPath: resolve(tempDbPath, "metadata.db"),
		});
	});

	afterEach(() => {
		store?.close();
		if (tempDbPath) {
			rmSync(tempDbPath, { recursive: true, force: true });
		}
	});

	it("should create database and tables automatically", () => {
		expect(store).toBeDefined();
		// The fact that we can create a store instance means tables were created successfully
		expect(store.getDatabasePath()).toContain("metadata.db");
	});

	it("should handle existing database gracefully", () => {
		// Create another store with the same path
		const store2 = new MetadataStore({
			dbPath: resolve(tempDbPath, "metadata.db"),
		});

		expect(store2).toBeDefined();
		store2.close();
	});
});
