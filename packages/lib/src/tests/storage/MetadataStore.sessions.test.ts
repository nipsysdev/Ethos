import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MetadataStore } from "@/storage/MetadataStore.js";

describe("MetadataStore - Sessions", () => {
	let tempDbPath: string;
	let store: MetadataStore;

	beforeEach(() => {
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

	it("should create crawl session", async () => {
		const sessionId = "test-session-1";
		const metadata = {
			startUrl: "https://example.com",
			maxPages: 10,
		};

		const session = store.createSession(
			sessionId,
			"test-source",
			"Test Source",
			new Date(),
			metadata,
		);

		expect(session).toBeDefined();
		expect(session.id).toBe(sessionId);
		expect(session.sourceId).toBe("test-source");
		expect(session.sourceName).toBe("Test Source");
	});

	it("should get crawl session", async () => {
		const sessionId = "test-session-2";
		const metadata = {
			startUrl: "https://example.com",
			maxPages: 10,
		};

		store.createSession(
			sessionId,
			"test-source",
			"Test Source",
			new Date(),
			metadata,
		);

		const session = store.getSession(sessionId);

		expect(session).toBeDefined();
		expect(session?.id).toBe(sessionId);
		expect(session?.sourceId).toBe("test-source");
		expect(session?.sourceName).toBe("Test Source");
		expect(session?.startTime).toBeInstanceOf(Date);
		expect(session?.endTime).toBeUndefined();
	});

	it("should return null for non-existent session", async () => {
		const session = store.getSession("non-existent-id");
		expect(session).toBeNull();
	});

	it("should update session metadata", async () => {
		const sessionId = "test-session-3";
		const initialMetadata = {
			startUrl: "https://example.com",
		};

		store.createSession(
			sessionId,
			"test-source",
			"Test Source",
			new Date(),
			initialMetadata,
		);

		const updatedMetadata = {
			startUrl: "https://example.com",
			status: "completed",
		};

		store.updateSession(sessionId, updatedMetadata);
		const session = store.getSession(sessionId);

		expect(session).toBeDefined();
		expect(JSON.parse(session?.metadata || "{}")).toEqual(updatedMetadata);
	});

	it("should end session", async () => {
		const sessionId = "test-session-4";
		const metadata = {
			startUrl: "https://example.com",
		};

		store.createSession(
			sessionId,
			"test-source",
			"Test Source",
			new Date(),
			metadata,
		);

		expect(store.isSessionActive(sessionId)).toBe(true);

		store.endSession(sessionId);
		const session = store.getSession(sessionId);

		expect(session).toBeDefined();
		expect(session?.endTime).toBeInstanceOf(Date);
		expect(store.isSessionActive(sessionId)).toBe(false);
	});

	it("should handle multiple sessions for same source", async () => {
		const sessionId1 = "session-1";
		const sessionId2 = "session-2";

		store.createSession(sessionId1, "source-a", "Source A", new Date(), {
			startUrl: "https://a.com/1",
		});

		store.createSession(sessionId2, "source-a", "Source A", new Date(), {
			startUrl: "https://a.com/2",
		});

		const session1 = store.getSession(sessionId1);
		const session2 = store.getSession(sessionId2);

		expect(session1).toBeDefined();
		expect(session2).toBeDefined();
		expect(session1?.sourceId).toBe("source-a");
		expect(session2?.sourceId).toBe("source-a");
		expect(session1?.id).toBe(sessionId1);
		expect(session2?.id).toBe(sessionId2);
	});

	it("should track session status via active check", async () => {
		const sessionId1 = "active-session";
		const sessionId2 = "ended-session";

		store.createSession(sessionId1, "test-source", "Test Source", new Date(), {
			startUrl: "https://example.com/1",
		});

		store.createSession(sessionId2, "test-source", "Test Source", new Date(), {
			startUrl: "https://example.com/2",
		});

		// End one session
		store.endSession(sessionId2);

		expect(store.isSessionActive(sessionId1)).toBe(true);
		expect(store.isSessionActive(sessionId2)).toBe(false);
	});

	it("should track sessions separately per source", async () => {
		store.createSession("session-a1", "source-a", "Source A", new Date(), {
			startUrl: "https://a.com",
		});
		store.createSession("session-a2", "source-a", "Source A", new Date(), {
			startUrl: "https://a2.com",
		});
		store.createSession("session-b1", "source-b", "Source B", new Date(), {
			startUrl: "https://b.com",
		});

		const sessionA1 = store.getSession("session-a1");
		const sessionA2 = store.getSession("session-a2");
		const sessionB1 = store.getSession("session-b1");

		expect(sessionA1?.sourceId).toBe("source-a");
		expect(sessionA2?.sourceId).toBe("source-a");
		expect(sessionB1?.sourceId).toBe("source-b");
	});
});
