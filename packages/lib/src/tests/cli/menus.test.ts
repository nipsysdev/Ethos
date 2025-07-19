import { describe, expect, it } from "vitest";

describe("menus module", () => {
	it("should exist and be importable", async () => {
		// Just test that we can import the module without errors
		const menusModule = await import("../../cli/ui/menus.js");
		expect(menusModule).toBeDefined();
		expect(typeof menusModule.showPostCrawlMenu).toBe("function");
	});

	it("should export showPostCrawlMenu function", async () => {
		const { showPostCrawlMenu } = await import("../../cli/ui/menus.js");
		expect(typeof showPostCrawlMenu).toBe("function");
	});
});
