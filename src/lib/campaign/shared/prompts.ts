import { readFileSync } from "node:fs";
import path from "node:path";

const stagePromptPath = (stageName: string) =>
  path.join(process.cwd(), "src", "lib", "campaign", "stages", stageName, "prompt.md");

export function readStagePrompt(stageName: string) {
  return readFileSync(stagePromptPath(stageName), "utf8").trim();
}
