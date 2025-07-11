// Core type definitions for the Ethos crawling library

export interface CrawledData {
	url: string;
	timestamp: Date;
	source: string;
	title: string;
	content: string;
	excerpt?: string;
	author?: string;
	tags?: string[];
	metadata: Record<string, unknown>;
}

export interface AnalysisResult {
	topics: string[];
	sentiment: number;
	relevance: number;
	keywords: string[];
	confidence: number;
	metadata: Record<string, unknown>;
}

export interface ProcessedData extends CrawledData {
	analysis: AnalysisResult[];
}

// Source configuration interfaces
export interface PaginationConfig {
	type: "load-more" | "numbered" | "infinite-scroll";
	selector: string;
	maxPages?: number;
}

export interface FilterConfig {
	dateRange?: {
		start?: Date;
		end?: Date;
	};
	categories?: string[];
	keywords?: string[];
}

export interface ListingConfig {
	url: string;
	itemSelector: string;
	pagination?: PaginationConfig;
	filters?: FilterConfig;
}

export interface ExtractionConfig {
	inline?: Record<string, string>; // Data available on listing page
	detail?: Record<string, string>; // Data requiring navigation to article
}

export interface SourceConfig {
	id: string;
	name: string;
	type: "article-listing" | "rss" | "api" | "social";
	listing: ListingConfig;
	extraction: ExtractionConfig;
	processingStrategies: string[];
}

// Strategy and crawler interfaces
export interface ProcessingStrategy {
	id: string;
	name: string;
	description: string;
	process(data: CrawledData): Promise<AnalysisResult>;
}

export interface Crawler {
	type: string;
	crawl(config: SourceConfig): Promise<CrawledData[]>;
}

// Registry interfaces
export interface SourceRegistry {
	loadSources(): Promise<SourceConfig[]>;
	getSource(id: string): Promise<SourceConfig | undefined>;
	getAllSources(): Promise<SourceConfig[]>;
}

export interface CrawlerRegistry {
	register(crawler: Crawler): void;
	getCrawler(type: string): Crawler | undefined;
	getSupportedTypes(): string[];
}

export interface StrategyRegistry {
	register(strategy: ProcessingStrategy): void;
	getStrategy(id: string): ProcessingStrategy | undefined;
	getAvailableStrategies(): ProcessingStrategy[];
}

// Error types
export class CrawlerError extends Error {
	constructor(
		message: string,
		public source?: string,
		public originalError?: Error,
	) {
		super(message);
		this.name = "CrawlerError";
	}
}

export class StrategyError extends Error {
	constructor(
		message: string,
		public strategyId?: string,
		public originalError?: Error,
	) {
		super(message);
		this.name = "StrategyError";
	}
}
