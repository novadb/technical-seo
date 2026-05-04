import pc from "picocolors";

let enabled = process.stdout.isTTY === true && !process.env.NO_COLOR;

export function setColorEnabled(value: boolean): void {
  enabled = value;
}

function wrap(fn: (s: string) => string) {
  return (s: string) => (enabled ? fn(s) : s);
}

export const colors = {
  bold: wrap(pc.bold),
  dim: wrap(pc.dim),
  red: wrap(pc.red),
  green: wrap(pc.green),
  yellow: wrap(pc.yellow),
  blue: wrap(pc.blue),
  cyan: wrap(pc.cyan),
  magenta: wrap(pc.magenta),
  gray: wrap(pc.gray),
};
