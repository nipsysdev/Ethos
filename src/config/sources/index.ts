import type { SourceConfig } from "@/core/types";
import { effSource } from "./eff.js";
import { fpfSource } from "./fpf.js";
import { lpeSource } from "./lpe.js";

export const sources: SourceConfig[] = [effSource, fpfSource, lpeSource];
