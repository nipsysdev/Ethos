import type { Crawler, CrawlerRegistry as ICrawlerRegistry } from "./types.js";

export class CrawlerRegistry implements ICrawlerRegistry {
	private crawlers: Map<string, Crawler> = new Map();

	register(crawler: Crawler): void {
		this.crawlers.set(crawler.type, crawler);
	}

	getCrawler(type: string): Crawler | undefined {
		return this.crawlers.get(type);
	}

	getSupportedTypes(): string[] {
		return Array.from(this.crawlers.keys());
	}
}
