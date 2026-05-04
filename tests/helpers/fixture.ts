import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");

export function loadFixture(name: string): string {
  const file = name.endsWith(".html") ? name : `${name}.html`;
  return readFileSync(join(fixturesDir, file), "utf8");
}
