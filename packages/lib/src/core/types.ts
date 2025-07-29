// Crawler type constants
export const CRAWLER_TYPES = {
	LISTING: "listing",
} as const;

export type CrawlerType = (typeof CRAWLER_TYPES)[keyof typeof CRAWLER_TYPES];

export interface CrawledData {
	url: string;
	timestamp: Date;
	source: string;
	title: string;
	content: string;
	author?: string;
	publishedDate?: string;
	image?: string;
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

export interface FieldConfig {
	selector: string;
	attribute: string;
	optional?: boolean;
}

export interface PaginationConfig {
	next_button_selector?: string;
	current_page_selector?: string;
	maxPages?: number;
}

export interface ItemsConfig {
	container_selector: string;
	fields: Record<string, FieldConfig>;
}

export interface ListingConfig {
	url: string;
	pagination?: PaginationConfig;
	items: ItemsConfig;
}

export interface DetailConfig {
	container_selector: string;
	fields: Record<string, FieldConfig>;
}

export interface SourceConfig {
	id: string;
	name: string;
	type: CrawlerType;
	listing: ListingConfig;
	detail?: DetailConfig;
}

export interface CrawlResult {
	data: CrawledData[];
	summary: CrawlSummary;
}

export interface Crawler {
	type: string;
	crawl(config: SourceConfig, options?: CrawlOptions): Promise<CrawlResult>;
}

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

export interface FieldExtractionStats {
	fieldName: string;
	successCount: number;
	totalAttempts: number;
	isOptional: boolean;
	missingItems: number[];
}

export interface CrawlSummary {
	sourceId: string;
	sourceName: string;
	itemsFound: number;
	itemsProcessed: number;
	itemsWithErrors: number;
	fieldStats: FieldExtractionStats[];
	detailFieldStats?: FieldExtractionStats[];
	listingErrors: string[];
	startTime: Date;
	endTime: Date;
	pagesProcessed?: number;
	duplicatesSkipped?: number;
	stoppedReason?: "max_pages" | "no_next_button" | "all_duplicates";
	detailsCrawled?: number;
	detailsSkipped?: number;
	detailErrors?: string[];
}

export interface CrawlOptions {
	maxPages?: number;
	skipDetails?: boolean;
}
