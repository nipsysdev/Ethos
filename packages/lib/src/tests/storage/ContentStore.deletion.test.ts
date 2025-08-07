import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentStore } from "@/storage/ContentStore.js";

// Mock the dynamic fs/promises import used in deleteContentFiles
const mockUnlink = vi.fn();
vi.doMock("node:fs/promises", () => ({
	unlink: mockUnlink,
}));

describe("ContentStore - Deletion Operations", () => {
	let contentStore: ContentStore;

	beforeEach(() => {
		vi.clearAllMocks();
		contentStore = new ContentStore({
			storageDir: "/test/storage",
			enableMetadata: false,
		});
	});

	it("should delete content files by hash successfully", async () => {
		// Mock successful file deletion
		mockUnlink.mockResolvedValue(undefined);

		const result = await contentStore.deleteContentFiles(["hash1", "hash2"]);

		expect(result.deleted).toBe(2);
		expect(result.errors).toHaveLength(0);
		expect(mockUnlink).toHaveBeenCalledTimes(2);
	});

	it("should handle non-existent files gracefully", async () => {
		// Mock file not found error
		const notFoundError = new Error("File not found") as NodeJS.ErrnoException;
		notFoundError.code = "ENOENT";
		mockUnlink.mockRejectedValue(notFoundError);

		const result = await contentStore.deleteContentFiles([
			"nonexistent1",
			"nonexistent2",
		]);

		expect(result.deleted).toBe(2); // Should still count as "deleted"
		expect(result.errors).toHaveLength(0);
		expect(mockUnlink).toHaveBeenCalledTimes(2);
	});

	it("should handle mixed success and failure", async () => {
		// First call succeeds, second fails with non-ENOENT error
		mockUnlink
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("Permission denied"));

		const result = await contentStore.deleteContentFiles(["hash1", "hash2"]);

		expect(result.deleted).toBe(1); // Only one successful deletion
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Failed to delete hash2.json");
		expect(mockUnlink).toHaveBeenCalledTimes(2);
	});

	it("should handle empty hash array", async () => {
		const result = await contentStore.deleteContentFiles([]);

		expect(result.deleted).toBe(0);
		expect(result.errors).toHaveLength(0);
		expect(mockUnlink).not.toHaveBeenCalled();
	});

	it("should handle permission errors correctly", async () => {
		// Mock permission denied error
		const permissionError = new Error(
			"Permission denied",
		) as NodeJS.ErrnoException;
		permissionError.code = "EACCES";
		mockUnlink.mockRejectedValue(permissionError);

		const result = await contentStore.deleteContentFiles(["hash1"]);

		expect(result.deleted).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Failed to delete hash1.json");
	});
});
