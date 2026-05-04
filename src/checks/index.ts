import type { Check } from "../types.js";
import { httpResponseCheck } from "./http-response.js";
import { documentFoundationCheck } from "./document-foundation.js";
import { metaHeadCheck } from "./meta-head.js";
import { headingsCheck } from "./headings.js";
import { imagesCheck } from "./images.js";
import { openGraphCheck } from "./open-graph.js";
import { twitterCardsCheck } from "./twitter-cards.js";
import { hreflangCheck } from "./hreflang.js";
import { structuredDataCheck } from "./structured-data.js";
import { linksCheck } from "./links.js";

export const CHECKS: ReadonlyArray<Check> = [
  httpResponseCheck,
  documentFoundationCheck,
  metaHeadCheck,
  headingsCheck,
  imagesCheck,
  openGraphCheck,
  twitterCardsCheck,
  hreflangCheck,
  structuredDataCheck,
  linksCheck,
];
