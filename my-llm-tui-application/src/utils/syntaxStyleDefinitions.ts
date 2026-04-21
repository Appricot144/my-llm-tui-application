import type { ThemeTokenStyle } from "@opentui/core";

export const SYNTAX_STYLE_DEFINITIONS: ThemeTokenStyle[] = [
  { scope: ["markup.heading"],   style: { foreground: "#4fc3f7", bold: true } },
  { scope: ["markup.heading.1"], style: { foreground: "#4fc3f7", bold: true } },
  { scope: ["markup.heading.2"], style: { foreground: "#81c784", bold: true } },
  { scope: ["markup.heading.3"], style: { foreground: "#ffb74d", bold: true } },
  { scope: ["markup.bold"],      style: { bold: true } },
  { scope: ["markup.italic"],    style: { italic: true } },
  { scope: ["markup.raw"],       style: { foreground: "#ce9178", background: "#2d2d2d" } },
  { scope: ["markup.rule"],      style: { foreground: "#555555", dim: true } },
  { scope: ["keyword"],          style: { foreground: "#c586c0" } },
  { scope: ["string"],           style: { foreground: "#ce9178" } },
  { scope: ["number"],           style: { foreground: "#b5cea8" } },
  { scope: ["comment"],          style: { foreground: "#6a9955" } },
  { scope: ["function"],         style: { foreground: "#dcdcaa" } },
  { scope: ["type"],             style: { foreground: "#4ec9b0" } },
];
