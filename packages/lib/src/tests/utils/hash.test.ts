import { describe, expect, it } from "vitest";
import { generateStringHash } from "@/utils/hash.js";

describe("Hash Utils", () => {
	describe("generateStringHash", () => {
		it("should generate consistent SHA-1 hashes for the same input", () => {
			const input = "test content";
			const hash1 = generateStringHash(input);
			const hash2 = generateStringHash(input);
			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(40); // SHA-1 produces 40-character hex strings
		});

		it("should generate different hashes for different inputs", () => {
			const input1 = "content one";
			const input2 = "content two";
			const hash1 = generateStringHash(input1);
			const hash2 = generateStringHash(input2);
			expect(hash1).not.toBe(hash2);
			expect(hash1).toHaveLength(40);
			expect(hash2).toHaveLength(40);
		});

		it("should handle empty strings", () => {
			const hash = generateStringHash("");

			expect(hash).toHaveLength(40);
			expect(hash).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709"); // Known SHA-1 of empty string
		});

		it("should generate SHA-1 hash with 40 character length", () => {
			const input = "any string";
			const hash = generateStringHash(input);

			expect(hash).toHaveLength(40);
			expect(hash).toMatch(/^[a-f0-9]{40}$/); // Should be valid hex
		});

		it("should generate the expected hash for a known input", () => {
			// Test with a known input to ensure hash generation is working correctly
			const input = "https://example.com/test";
			const hash = generateStringHash(input);

			// Pre-calculated SHA-1 for this specific string
			expect(hash).toBe("5f7714991cc5f08a3f404c785513f1e099e95b11");
		});

		it("should be case sensitive", () => {
			const input1 = "https://example.com/Test";
			const input2 = "https://example.com/test";

			const hash1 = generateStringHash(input1);
			const hash2 = generateStringHash(input2);

			expect(hash1).not.toBe(hash2);
		});
	});
});
