// Main extractor

// Helper modules for modular functionality
export {
	createBrowserExtractionFunction,
	extractFieldValue,
	extractTextWithExclusions,
} from "./BrowserFieldExtractor.js";
export {
	mergeDetailData,
	updateFieldStats,
	updateItemMetadata,
} from "./DetailDataMapper.js";
export type { DetailExtractionResult } from "./DetailPageExtractor.js";
export { DetailPageExtractor } from "./DetailPageExtractor.js";
