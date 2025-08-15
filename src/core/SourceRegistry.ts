import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { validateSources } from "@/core/sourceValidation";
import type {
	SourceRegistry as ISourceRegistry,
	SourceConfig,
} from "@/core/types";

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

			this.sources.clear();

			const sources: SourceConfig[] = validateSources(config.sources);
			for (const source of sources) {
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
}
