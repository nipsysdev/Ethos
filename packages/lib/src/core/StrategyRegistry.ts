import type {
	StrategyRegistry as IStrategyRegistry,
	ProcessingStrategy,
} from "./types.js";

export class StrategyRegistry implements IStrategyRegistry {
	private strategies: Map<string, ProcessingStrategy> = new Map();

	register(strategy: ProcessingStrategy): void {
		this.strategies.set(strategy.id, strategy);
	}

	getStrategy(id: string): ProcessingStrategy | undefined {
		return this.strategies.get(id);
	}

	getAvailableStrategies(): ProcessingStrategy[] {
		return Array.from(this.strategies.values());
	}
}
