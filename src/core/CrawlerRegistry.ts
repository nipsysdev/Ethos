import type {
	Crawler,
	CrawlerRegistry as ICrawlerRegistry,
} from "@/core/types";

export function createCrawlerRegistry(): ICrawlerRegistry {
	const crawlers = new Map<string, Crawler>();

	return {
		register(crawler: Crawler): void {
			crawlers.set(crawler.type, crawler);
		},

		getCrawler(type: string): Crawler | undefined {
			return crawlers.get(type);
		},

		getSupportedTypes(): string[] {
			return Array.from(crawlers.keys());
		},
	};
}
