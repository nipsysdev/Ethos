import { describe, expect, it } from "vitest";
import { InterruptionHandler } from "@/crawlers/utils/InterruptionHandler";

describe("InterruptionHandler", () => {
	it("should detect interruption correctly", () => {
		const handler = new InterruptionHandler();

		// Initially not interrupted
		expect(handler.isProcessInterrupted()).toBe(false);

		// Set up signal handlers
		handler.setup();
		expect(handler.isProcessInterrupted()).toBe(false);

		// Cleanup
		handler.cleanup();
	});

	it("should provide abort signal", () => {
		const handler = new InterruptionHandler();

		// Should be undefined before setup
		expect(handler.getAbortSignal()).toBeUndefined();

		// Should provide signal after setup
		handler.setup();
		expect(handler.getAbortSignal()).toBeInstanceOf(AbortSignal);

		// Cleanup
		handler.cleanup();
		expect(handler.getAbortSignal()).toBeUndefined();
	});

	it("should handle multiple setup calls gracefully", () => {
		const handler = new InterruptionHandler();

		// Multiple setups should not cause issues
		handler.setup();
		handler.setup();
		handler.setup();

		expect(handler.isProcessInterrupted()).toBe(false);

		// Cleanup
		handler.cleanup();
	});

	it("should reset state after cleanup", () => {
		const handler = new InterruptionHandler();

		handler.setup();
		const signal1 = handler.getAbortSignal();

		handler.cleanup();
		expect(handler.getAbortSignal()).toBeUndefined();

		// Setup again should work
		handler.setup();
		const signal2 = handler.getAbortSignal();

		expect(signal2).toBeInstanceOf(AbortSignal);
		expect(signal2).not.toBe(signal1); // Should be a new signal

		handler.cleanup();
	});
});
