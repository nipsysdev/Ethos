import type { SourceConfig } from "@/core/types";
import { AccessNowSource } from "./access_now.js";
import { DeclassifiedUkSource } from "./declassified_uk.js";
import { ElectronicFrontierFoundationSource } from "./electronic_frontier_foundation.js";
import { FreedomPressFoundationSource } from "./freedom_press_foundation.js";
import { LogosPressEngineSource } from "./logos_press_engine.js";
import { P2pFoundationSource } from "./p2p_foundation.js";
import { TorrentFreakSource } from "./torrent_freak.js";

export const sources: SourceConfig[] = [
	ElectronicFrontierFoundationSource,
	FreedomPressFoundationSource,
	LogosPressEngineSource,
	P2pFoundationSource,
	DeclassifiedUkSource,
	TorrentFreakSource,
	AccessNowSource,
];
