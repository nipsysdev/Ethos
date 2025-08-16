export interface InterruptionHandler {
	setup(): void;
	isProcessInterrupted(): boolean;
	cleanup(): void;
	getAbortSignal(): AbortSignal | undefined;
}

export function createInterruptionHandler(): InterruptionHandler {
	let isInterrupted = false;
	let signalHandlersSetup = false;
	let abortController: AbortController | undefined;
	const signalHandlers: Array<{
		signal: string;
		handler: (...args: unknown[]) => void;
	}> = [];

	function setup(): void {
		if (signalHandlersSetup) return;

		abortController = new AbortController();
		const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

		signals.forEach((signal) => {
			const handler = () => {
				isInterrupted = true;
				abortController?.abort();
				console.log(
					`\nProcess interrupted (${signal}), stopping gracefully...`,
				);
			};

			process.on(signal, handler);
			signalHandlers.push({ signal, handler });
		});

		signalHandlersSetup = true;
	}

	function isProcessInterrupted(): boolean {
		return isInterrupted || abortController?.signal.aborted || false;
	}

	function cleanup(): void {
		signalHandlers.forEach(({ signal, handler }) => {
			process.removeListener(signal as NodeJS.Signals, handler);
		});
		signalHandlers.length = 0;
		signalHandlersSetup = false;
		abortController = undefined;
		isInterrupted = false;
	}

	function getAbortSignal(): AbortSignal | undefined {
		return abortController?.signal;
	}

	return {
		setup,
		isProcessInterrupted,
		cleanup,
		getAbortSignal,
	};
}
