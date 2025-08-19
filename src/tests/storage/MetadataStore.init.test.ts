import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore.js";
import { METADATA_DB_NAME } from "@/utils";

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

		store = createMetadataStore(tempDbPath);
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
		expect(store.getDatabasePath()).toContain(METADATA_DB_NAME);
	});

	it("should handle existing database gracefully", () => {
		// Create another store with the same path
		const store2 = createMetadataStore(tempDbPath);

		expect(store2).toBeDefined();
		store2.close();
	});
});
