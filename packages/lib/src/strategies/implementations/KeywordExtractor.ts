import type {
	AnalysisResult,
	CrawledData,
	ProcessingStrategy,
} from "../../core/types.js";

export class KeywordExtractor implements ProcessingStrategy {
	id = "keyword-extractor";
	name = "Keyword Extractor";
	description = "Extracts keywords from article content";

	async process(data: CrawledData): Promise<AnalysisResult> {
		const text = `${data.title} ${data.content}`.toLowerCase();

		// Simple keyword extraction based on digital rights terms
		const digitalRightsKeywords = [
			"privacy",
			"surveillance",
			"encryption",
			"censorship",
			"freedom",
			"rights",
			"data protection",
			"digital",
			"internet",
			"security",
			"transparency",
			"democracy",
			"civil liberties",
			"human rights",
		];

		const foundKeywords = digitalRightsKeywords.filter((keyword) =>
			text.includes(keyword),
		);

		// Simple relevance scoring
		const relevance = foundKeywords.length / digitalRightsKeywords.length;

		return {
			topics: this.extractTopics(foundKeywords),
			sentiment: 0, // Neutral for now
			relevance,
			keywords: foundKeywords,
			confidence: 0.7, // Basic confidence
			metadata: {
				strategy: this.id,
				totalWords: text.split(" ").length,
				keywordDensity: foundKeywords.length / text.split(" ").length,
			},
		};
	}

	private extractTopics(keywords: string[]): string[] {
		const topics = [];

		if (
			keywords.some((k) =>
				["privacy", "surveillance", "data protection"].includes(k),
			)
		) {
			topics.push("privacy");
		}
		if (
			keywords.some((k) =>
				["censorship", "freedom", "civil liberties"].includes(k),
			)
		) {
			topics.push("censorship");
		}
		if (
			keywords.some((k) => ["encryption", "security", "digital"].includes(k))
		) {
			topics.push("digital-security");
		}
		if (
			keywords.some((k) => ["rights", "human rights", "democracy"].includes(k))
		) {
			topics.push("human-rights");
		}

		return topics;
	}
}
