import type { ContentFieldName } from "@/crawlers/extractors/ContentPageExtractor";
import type {
	ExtractedListingValues,
	ListingFieldName,
} from "@/crawlers/extractors/ListingPageExtractor";
import type { StoppedReason } from "@/crawlers/MetadataTracker";

export enum CrawlerType {
	Listing = "listing",
}

// Core crawler interfaces
export interface Crawler {
	type: string;
	crawl(config: SourceConfig, options?: CrawlOptions): Promise<CrawlResult>;
}

export interface CrawlerRegistry {
	register(crawler: Crawler): void;
	getCrawler(type: string): Crawler | undefined;
	getSupportedTypes(): string[];
}

// Configuration types
export interface FieldConfig {
	selector: string;
	attribute: string;
	optional?: boolean;
	exclude_selectors?: string[];
}

export interface PaginationConfig {
	next_button_selector?: string;
	delaySec?: number;
}

export interface ListingConfig {
	url: string;
	pagination?: PaginationConfig;
	container_selector: string;
	shouldExcludeItem?: (
		containerHtml: string,
		values?: ExtractedListingValues,
	) => boolean;
	fields: Partial<Record<ListingFieldName, FieldConfig>>;
}

export interface ContentConfig {
	container_selector: string;
	fields: Partial<Record<ContentFieldName, FieldConfig>>;
}

export interface SourceConfig {
	id: string;
	name: string;
	type: CrawlerType;
	disableJavascript?: boolean;
	listing: ListingConfig;
	content: ContentConfig;
}

// Data structures for content and crawling
export interface ContentData {
	url: string;
	title: string;
	content: string;
	author?: string;
	publishedDate?: string; // ISO 8601 string, strictly validated (throws if unparseable)
}

export interface CrawledData extends ContentData {
	crawledAt: Date;
	source: string;
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

export interface CrawlMetadataItem {
	url: string;
	title: string;
	hash: string;
	publishedDate?: string;
}

// Results and options
export interface CrawlResult {
	data: CrawledData[];
	summary: CrawlSummary;
}

export interface CrawlOptions {
	maxPages?: number;
	onPageComplete?: (items: CrawledData[]) => Promise<void>;
	contentConcurrency?: number; // Number of content pages to crawl concurrently (default: 8)
	metadataTracker?: ContentSessionLinker; // MetadataTracker instance for junction table linking
	skipExistingUrls?: boolean; // Skip content crawling for URLs already in database (default: true)
	/**
	 * Stop crawling when all items on a page are duplicates (default: true)
	 *
	 * true: Stop when a page contains only items already in database (efficient for chronological content)
	 * false: Continue crawling even if all items on a page are duplicates (thorough for mixed content)
	 */
	stopOnAllDuplicates?: boolean;
}

// Statistics and metadata
export interface FieldExtractionStats {
	fieldName: ListingFieldName | ContentFieldName;
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
	contentFieldStats: FieldExtractionStats[];
	listingErrors: string[];
	startTime: Date;
	endTime: Date;
	pagesProcessed?: number;
	duplicatesSkipped?: number;
	urlsExcluded?: number;
	stoppedReason?: StoppedReason;
	contentsCrawled?: number;
	contentErrors?: string[];
	sessionId?: string; // Session ID for accessing crawl metadata from database
	storageStats?: {
		itemsStored: number;
		itemsFailed: number;
	};
}

export interface CrawlMetadata {
	duplicatesSkipped: number;
	urlsExcluded: number; // URLs excluded by content_url_excludes patterns
	totalFilteredItems: number;
	itemsProcessed: number; // Track total items processed (replaces itemUrls.length)
	pagesProcessed: number;
	contentsCrawled: number;
	fieldStats: FieldExtractionStats[];
	contentFieldStats: FieldExtractionStats[];
	listingErrors: string[];
	contentErrors: string[];
	stoppedReason?: StoppedReason;
}

// Interface for junction table linking
export interface ContentSessionLinker {
	linkContentToSession(
		contentId: number,
		hadContentExtractionError?: boolean,
	): void;
}

// Command parameter interfaces
export interface CrawlOptionsCLI {
	source: string;
	maxPages?: number;
	stopOnAllDuplicates?: boolean;
	reCrawlExisting?: boolean;
	output?: "json" | "summary";
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
