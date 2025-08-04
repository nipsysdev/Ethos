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
	publishedDate?: string; // ISO 8601 string, strictly validated (throws if unparseable)
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
	storage?: {
		hash: string;
		path: string;
		storedAt: Date;
	};
}

export interface FieldConfig {
	selector: string;
	attribute: string;
	optional?: boolean;
	exclude_selectors?: string[];
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
	detail: DetailConfig;
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
	detailFieldStats: FieldExtractionStats[];
	listingErrors: string[];
	startTime: Date;
	endTime: Date;
	pagesProcessed?: number;
	duplicatesSkipped?: number;
	stoppedReason?: "max_pages" | "no_next_button" | "all_duplicates";
	detailsCrawled?: number;
	detailErrors?: string[];
	tempMetadataFile?: string; // Path to temporary metadata file for viewer access
}

export interface CrawlOptions {
	maxPages?: number;
	onPageComplete?: (items: CrawledData[]) => Promise<void>;
	detailConcurrency?: number;
}

// Shared types for crawl metadata
export interface CrawlMetadataItem {
	url: string;
	title: string;
	hash: string;
	publishedDate?: string;
}

export interface CrawlMetadata {
	sourceId: string;
	sourceName: string;
	startTime: Date;
	itemUrls: string[];
	itemsForViewer: CrawlMetadataItem[];
	duplicatesSkipped: number;
	totalFilteredItems: number;
	pagesProcessed: number;
	detailsCrawled: number;
	fieldStats: FieldExtractionStats[];
	detailFieldStats: FieldExtractionStats[];
	listingErrors: string[];
	detailErrors: string[];
	stoppedReason?: "max_pages" | "no_next_button" | "all_duplicates";
}
