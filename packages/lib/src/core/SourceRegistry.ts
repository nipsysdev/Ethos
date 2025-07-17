import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type {
	SourceRegistry as ISourceRegistry,
	SourceConfig,
} from "./types.js";

export class SourceRegistry implements ISourceRegistry {
	private sources: Map<string, SourceConfig> = new Map();
	private configPath: string;

	constructor(configPath?: string) {
		this.configPath =
			configPath || join(process.cwd(), "config", "sources.yaml");
	}

	async loadSources(): Promise<SourceConfig[]> {
		try {
			const configContent = await readFile(this.configPath, "utf-8");
			const config = parse(configContent);

			if (!config.sources || !Array.isArray(config.sources)) {
				throw new Error("Invalid config: 'sources' must be an array");
			}

			// Clear existing sources
			this.sources.clear();

			// Load new sources
			const sources: SourceConfig[] = config.sources;
			for (const source of sources) {
				this.validateSource(source);
				this.sources.set(source.id, source);
			}

			return Array.from(this.sources.values());
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to load sources: ${error.message}`);
			}
			throw error;
		}
	}

	async getSource(id: string): Promise<SourceConfig | undefined> {
		if (this.sources.size === 0) {
			await this.loadSources();
		}
		return this.sources.get(id);
	}

	async getAllSources(): Promise<SourceConfig[]> {
		if (this.sources.size === 0) {
			await this.loadSources();
		}
		return Array.from(this.sources.values());
	}

	private validateSource(source: unknown): asserts source is SourceConfig {
		if (!source || typeof source !== "object") {
			throw new Error("Source must be an object");
		}

		const s = source as Record<string, unknown>;

		if (!s.id || typeof s.id !== "string") {
			throw new Error("Source must have a valid 'id' field");
		}
		if (!s.name || typeof s.name !== "string") {
			throw new Error(`Source '${s.id}' must have a valid 'name' field`);
		}
		if (
			!s.type ||
			!["article-listing", "rss", "api", "social"].includes(s.type as string)
		) {
			throw new Error(`Source '${s.id}' must have a valid 'type' field`);
		}
		if (!s.listing || typeof s.listing !== "object") {
			throw new Error(
				`Source '${s.id}' must have a valid 'listing' configuration`,
			);
		}
		if (!s.extraction || typeof s.extraction !== "object") {
			throw new Error(`Source '${s.id}' must have extraction configuration`);
		}
		if (!Array.isArray(s.processingStrategies)) {
			throw new Error(
				`Source '${s.id}' must have a 'processingStrategies' array`,
			);
		}
	}
}
