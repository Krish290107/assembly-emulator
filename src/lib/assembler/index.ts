import type { AssemblyResult } from "../../types/engine.ts";
import { firstPass } from "./first-pass.ts";
import { parseSource } from "./parser.ts";
import { secondPass } from "./second-pass.ts";

/** Assemble source into a complete origin-zero binary, or diagnostics only. */
export function assembleSource(source: string): AssemblyResult {
  return secondPass(firstPass(parseSource(source)));
}
