import { readFileSync } from "node:fs";
import path from "node:path";

const promptPath = (...segments: string[]) => path.join(process.cwd(), "prompts", ...segments);

export function readPrompt(name: string) {
  return readFileSync(promptPath(name), "utf8").trim();
}

export function buildStrategyPrompt() {
  return readPrompt("strategy-generation.md");
}

export function buildExecutionPrompt() {
  return readPrompt("execution-generation.md");
}

export function buildRepairPrompt() {
  return readPrompt("repair-response.md");
}
