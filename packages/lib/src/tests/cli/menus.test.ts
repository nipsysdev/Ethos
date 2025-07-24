import { describe, expect, it } from "vitest";

describe("menus module", () => {
	it("should export showPostCrawlMenu function", async () => {
		const { showPostCrawlMenu } = await import("../../cli/ui/menus.js");
		expect(typeof showPostCrawlMenu).toBe("function");
	});
});
