/**
 * Handles process interruption signals for crawling operations
 * Provides clean signal handling and graceful interruption detection
 */
export class InterruptionHandler {
	private isInterrupted = false;
	private signalHandlersSetup = false;
	private signalHandlers: Array<{
		signal: string;
		handler: (...args: unknown[]) => void;
	}> = [];
	private abortController?: AbortController;

	/**
	 * Set up signal handlers for graceful interruption
	 */
	setup(): void {
		if (this.signalHandlersSetup) return;

		this.abortController = new AbortController();
		const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

		signals.forEach((signal) => {
			const handler = () => {
				this.isInterrupted = true;
				this.abortController?.abort();
				console.log(
					`\nProcess interrupted (${signal}), stopping gracefully...`,
				);
			};

			process.on(signal, handler);
			this.signalHandlers.push({ signal, handler });
		});

		this.signalHandlersSetup = true;
	}

	/**
	 * Check if the process has been interrupted
	 */
	isProcessInterrupted(): boolean {
		return this.isInterrupted || this.abortController?.signal.aborted || false;
	}

	/**
	 * Clean up signal handlers
	 */
	cleanup(): void {
		this.signalHandlers.forEach(({ signal, handler }) => {
			process.removeListener(signal as NodeJS.Signals, handler);
		});
		this.signalHandlers = [];
		this.signalHandlersSetup = false;
		this.abortController = undefined;
		this.isInterrupted = false;
	}

	/**
	 * Get the abort signal for use with async operations
	 */
	getAbortSignal(): AbortSignal | undefined {
		return this.abortController?.signal;
	}
}
