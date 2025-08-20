import { mkdirSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createContentStore } from "@/storage/ContentStore.js";
import { CONTENT_DIR_NAME } from "@/utils/storagePath.js";

describe("ContentStore - Constructor", () => {
	let testStorageDir: string;
	let tempDbPath: string;

	beforeEach(async () => {
		// Create unique directory for each test run to avoid conflicts
		testStorageDir = `./test-storage-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
		tempDbPath = resolve(
			process.cwd(),
			`test-db-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		mkdirSync(tempDbPath, { recursive: true });

		// Ensure clean state by removing directory if it exists
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory doesn't exist, which is fine
		}
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testStorageDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist, which is fine
		}
		if (tempDbPath) {
			rmSync(tempDbPath, { recursive: true, force: true });
		}
	});

	it("should create ContentStore with default settings", () => {
		const store = createContentStore(tempDbPath);
		expect(store).toBeDefined();
		expect(store.getStorageDirectory).toBeDefined();
		expect(store.getMetadataStore).toBeDefined();
		expect(store.store).toBeDefined();
		expect(store.retrieve).toBeDefined();
		expect(store.exists).toBeDefined();
	});

	it("should create ContentStore with custom storage directory", () => {
		const customStore = createContentStore(testStorageDir);
		expect(customStore).toBeDefined();
		expect(customStore.getStorageDirectory()).toBe(
			resolve(`${testStorageDir}/${CONTENT_DIR_NAME}`),
		);
	});

	it("should create ContentStore with metadata disabled", () => {
		const store = createContentStore(testStorageDir, false);
		expect(store).toBeDefined();
		expect(store.getMetadataStore()).toBeUndefined();
	});
});
