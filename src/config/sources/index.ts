import type { SourceConfig } from "@/core/types";
import { dukSource } from "./duk.js";
import { effSource } from "./eff.js";
import { fpfSource } from "./fpf.js";
import { lpeSource } from "./lpe.js";
import { p2pSource } from "./p2p.js";

export const sources: SourceConfig[] = [
	effSource,
	fpfSource,
	lpeSource,
	p2pSource,
	dukSource,
];
