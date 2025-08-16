export function resolveAbsoluteUrl(url: string, baseUrl: string): string {
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}

	try {
		const resolved = new URL(url, baseUrl).href;
		return resolved;
	} catch (error) {
		throw new Error(
			`Failed to resolve URL "${url}" against base "${baseUrl}": ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
