import type { SourceRange } from "../../types/engine.ts";

export interface SourceToken {
  kind: "atom" | "colon";
  text: string;
  source: SourceRange;
}

export interface ScannedLine {
  tokens: readonly SourceToken[];
}

export function scanSource(source: string): readonly ScannedLine[] {
  return source.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).map((line, index) => {
    const tokens: SourceToken[] = [];
    let column = 0;
    while (column < line.length && line[column] !== ";") {
      if (line[column] === " " || line[column] === "\t") { column++; continue; }
      const start = column;
      const kind = line[column++] === ":" ? "colon" : "atom";
      if (kind === "atom") {
        while (column < line.length && !" \t:;".includes(line[column])) column++;
      }
      tokens.push({ kind, text: line.slice(start, column), source: { start: { line: index + 1, column: start + 1 }, end: { line: index + 1, column: column + 1 } } });
    }
    return { tokens };
  });
}
