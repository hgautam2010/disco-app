import { readFileSync } from "node:fs";
import path from "node:path";

const promptPath = (...segments: string[]) => path.join(process.cwd(), "prompts", ...segments);

function readPrompt(name: string) {
  return readFileSync(promptPath(name), "utf8").trim();
}

export function buildRepairPrompt() {
  return readPrompt("repair-response.md");
}
