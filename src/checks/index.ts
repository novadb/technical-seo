import type { Check } from "../types.js";
import { httpResponseCheck } from "./http-response.js";
import { documentFoundationCheck } from "./document-foundation.js";
import { metaHeadCheck } from "./meta-head.js";
import { canonicalCheck } from "./canonical.js";
import { headingsCheck } from "./headings.js";
import { imagesCheck } from "./images.js";
import { openGraphCheck } from "./open-graph.js";
import { twitterCardsCheck } from "./twitter-cards.js";
import { hreflangCheck } from "./hreflang.js";
import { structuredDataCheck } from "./structured-data.js";
import { linksCheck } from "./links.js";
import { robotsCheck } from "./robots.js";
import { performanceCheck } from "./performance.js";

export const CHECKS: ReadonlyArray<Check> = [
  httpResponseCheck,
  documentFoundationCheck,
  metaHeadCheck,
  canonicalCheck,
  headingsCheck,
  imagesCheck,
  openGraphCheck,
  hreflangCheck,
  structuredDataCheck,
  linksCheck,
  robotsCheck,
  performanceCheck,
];

export const OPTIONAL_CHECKS = {
  twitter: twitterCardsCheck,
} as const;
