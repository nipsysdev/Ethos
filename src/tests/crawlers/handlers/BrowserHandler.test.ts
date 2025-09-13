import type { Browser, Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createBrowserHandler } from "@/crawlers/handlers/BrowserHandler.js";
import * as urlUtils from "@/utils/url.js";

// Mock the puppeteer module
vi.mock("puppeteer", () => {
	const mockPuppeteer = {
		launch: vi.fn(),
	};
	return {
		default: mockPuppeteer,
	};
});

// Mock the url utility
vi.mock("@/utils/url.js", () => ({
	resolveAbsoluteUrl: vi.fn(),
}));

describe("BrowserHandler", () => {
	// Mock timers for all tests to avoid real delays
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	const mockConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CRAWLER_TYPES.LISTING,
		disableJavascript: false,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: ".article",
				fields: {
					title: { selector: ".title", attribute: "text" },
				},
			},
		},
		content: {
			container_selector: ".article-content",
			fields: {
				content: { selector: ".content", attribute: "text" },
			},
		},
	};

	// Helper to create a mock browser with common behavior
	const createMockBrowser = (overrides: Partial<Browser> = {}) => {
		const defaultMocks = {
			newPage: vi.fn(),
			close: vi.fn(),
		};
		return { ...defaultMocks, ...overrides } as unknown as Browser;
	};

	// Helper to create a mock page with common behavior
	const createMockPage = (overrides: Partial<Page> = {}) => {
		const defaultMocks = {
			on: vi.fn().mockReturnThis(),
			setViewport: vi.fn().mockResolvedValue(undefined),
			setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
			setRequestInterception: vi.fn().mockResolvedValue(undefined),
			goto: vi.fn().mockResolvedValue(undefined),
		};
		return { ...defaultMocks, ...overrides } as unknown as Page;
	};

	it("should create a browser handler with correct methods", async () => {
		const mockBrowser = createMockBrowser();
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const handler = await createBrowserHandler(mockConfig);

		expect(handler).toBeDefined();
		expect(typeof handler.resetBrowser).toBe("function");
		expect(typeof handler.setupNewPage).toBe("function");
		expect(typeof handler.goto).toBe("function");
		expect(typeof handler.close).toBe("function");
	});

	it("should launch browser with correct configuration", async () => {
		const mockBrowser = createMockBrowser();
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		await createBrowserHandler(mockConfig);

		expect(puppeteer.default.launch).toHaveBeenCalledWith({
			browser: "chrome",
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	});

	it("should reset browser by closing and recreating it", async () => {
		const mockBrowser1 = createMockBrowser({ close: vi.fn() });
		const mockBrowser2 = createMockBrowser();
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any)
			.mockResolvedValueOnce(mockBrowser1)
			.mockResolvedValueOnce(mockBrowser2);

		const handler = await createBrowserHandler(mockConfig);

		await handler.resetBrowser();

		expect(mockBrowser1.close).toHaveBeenCalled();
		expect(puppeteer.default.launch).toHaveBeenCalledTimes(2);
	});

	it("should setup a new page with correct configuration", async () => {
		const mockPage = createMockPage({
			on: vi.fn().mockReturnThis(),
			setViewport: vi.fn().mockResolvedValue(undefined),
			setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
			setRequestInterception: vi.fn().mockResolvedValue(undefined),
		});
		const mockBrowser = createMockBrowser({
			newPage: vi.fn().mockResolvedValue(mockPage),
		});
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const handler = await createBrowserHandler(mockConfig);
		const page = await handler.setupNewPage();

		expect(mockBrowser.newPage).toHaveBeenCalled();
		expect(mockPage.on).toHaveBeenCalledTimes(2); // request and error events
		expect(mockPage.setViewport).toHaveBeenCalledWith({
			width: 1920,
			height: 1080,
		});
		expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(true); // config.disableJavascript is false
		expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
		expect(page).toBe(mockPage);
	});

	it("should setup a new page with disabled JavaScript when configured", async () => {
		const mockPage = createMockPage();
		const mockBrowser = createMockBrowser({
			newPage: vi.fn().mockResolvedValue(mockPage),
		});
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const configWithDisabledJS: SourceConfig = {
			...mockConfig,
			disableJavascript: true,
		};

		const handler = await createBrowserHandler(configWithDisabledJS);
		await handler.setupNewPage();

		expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
	});

	it("should setup a new page and navigate to URL when provided", async () => {
		const mockPage = createMockPage({
			goto: vi.fn().mockResolvedValue(undefined),
		});
		const mockBrowser = createMockBrowser({
			newPage: vi.fn().mockResolvedValue(mockPage),
		});
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);
		const mockAbsoluteUrl = "https://example.com/test-page";
		(urlUtils.resolveAbsoluteUrl as any).mockReturnValue(mockAbsoluteUrl);

		const handler = await createBrowserHandler(mockConfig);
		const url = "/test-page";
		await handler.setupNewPage(url);

		expect(urlUtils.resolveAbsoluteUrl).toHaveBeenCalledWith(
			url,
			mockConfig.listing.url,
		);
		expect(mockPage.goto).toHaveBeenCalledWith(mockAbsoluteUrl, {
			waitUntil: "domcontentloaded",
			timeout: 60000,
		});
	});

	it("should handle request interception for media, image, and font resources", async () => {
		const mockPage = createMockPage();
		const mockBrowser = createMockBrowser({
			newPage: vi.fn().mockResolvedValue(mockPage),
		});
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const handler = await createBrowserHandler(mockConfig);
		await handler.setupNewPage();

		// Get the request event handler calls
		const onCalls = (mockPage.on as any).mock.calls;
		const requestEventHandler = onCalls.find(
			(call: any) => call[0] === "request",
		)[1];

		// Test aborting media requests
		const mockMediaRequest = {
			resourceType: vi.fn().mockReturnValue("media"),
			abort: vi.fn(),
			continue: vi.fn(),
		};
		requestEventHandler(mockMediaRequest);
		expect(mockMediaRequest.abort).toHaveBeenCalled();
		expect(mockMediaRequest.continue).not.toHaveBeenCalled();

		// Test aborting image requests
		const mockImageRequest = {
			resourceType: vi.fn().mockReturnValue("image"),
			abort: vi.fn(),
			continue: vi.fn(),
		};
		requestEventHandler(mockImageRequest);
		expect(mockImageRequest.abort).toHaveBeenCalled();
		expect(mockImageRequest.continue).not.toHaveBeenCalled();

		// Test aborting font requests
		const mockFontRequest = {
			resourceType: vi.fn().mockReturnValue("font"),
			abort: vi.fn(),
			continue: vi.fn(),
		};
		requestEventHandler(mockFontRequest);
		expect(mockFontRequest.abort).toHaveBeenCalled();
		expect(mockFontRequest.continue).not.toHaveBeenCalled();

		// Test continuing other requests
		const mockDocumentRequest = {
			resourceType: vi.fn().mockReturnValue("document"),
			abort: vi.fn(),
			continue: vi.fn(),
		};
		requestEventHandler(mockDocumentRequest);
		expect(mockDocumentRequest.abort).not.toHaveBeenCalled();
		expect(mockDocumentRequest.continue).toHaveBeenCalled();
	});

	it("should handle browser errors gracefully", async () => {
		const mockConsoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const mockPage = createMockPage();
		const mockBrowser = createMockBrowser({
			newPage: vi.fn().mockResolvedValue(mockPage),
		});
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const handler = await createBrowserHandler(mockConfig);
		await handler.setupNewPage();

		// Get the error event handler calls
		const onCalls = (mockPage.on as any).mock.calls;
		const errorEventHandler = onCalls.find(
			(call: any) => call[0] === "error",
		)[1];

		// Test error handling
		const mockError = new Error("Test browser error");
		errorEventHandler(mockError);

		expect(mockConsoleError).toHaveBeenCalledWith(
			"BROWSER ERROR: Test browser error",
		);

		mockConsoleError.mockRestore();
	});

	it("should navigate to a URL using goto method", async () => {
		const mockPage = createMockPage({
			goto: vi.fn().mockResolvedValue(undefined),
		});
		const mockBrowser = createMockBrowser();
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);
		const mockAbsoluteUrl = "https://example.com/test-page";
		(urlUtils.resolveAbsoluteUrl as any).mockReturnValue(mockAbsoluteUrl);

		const handler = await createBrowserHandler(mockConfig);
		const url = "/test-page";
		await handler.goto(mockPage, url);

		expect(urlUtils.resolveAbsoluteUrl).toHaveBeenCalledWith(
			url,
			mockConfig.listing.url,
		);
		expect(mockPage.goto).toHaveBeenCalledWith(mockAbsoluteUrl, {
			waitUntil: "domcontentloaded",
			timeout: 60000,
		});
	});

	it("should handle navigation errors gracefully", async () => {
		const mockPage = createMockPage({
			goto: vi.fn().mockRejectedValue(new Error("Navigation timeout")),
		});
		const mockBrowser = createMockBrowser();
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);
		(urlUtils.resolveAbsoluteUrl as any).mockReturnValue(
			"https://example.com/test-page",
		);

		const handler = await createBrowserHandler(mockConfig);
		const url = "/test-page";

		// Should not throw an error
		await expect(handler.goto(mockPage, url)).resolves.toBeUndefined();
	});

	it("should close the browser", async () => {
		const mockBrowser = createMockBrowser({ close: vi.fn() });
		const puppeteer = await import("puppeteer");
		(puppeteer.default.launch as any).mockResolvedValue(mockBrowser);

		const handler = await createBrowserHandler(mockConfig);
		await handler.close();

		expect(mockBrowser.close).toHaveBeenCalled();
	});
});
