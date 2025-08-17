// Main extractor

// Helper modules for modular functionality
export {
	createBrowserExtractionFunction,
	extractFieldValue,
	extractTextWithExclusions,
} from "./BrowserFieldExtractor.js";
export {
	mergeContentData,
	updateFieldStats,
	updateItemMetadata,
} from "./ContentDataMapper.js";
export type { ContentExtractionResult } from "./ContentPageExtractor.js";
export { createContentPageExtractor } from "./ContentPageExtractor.js";
