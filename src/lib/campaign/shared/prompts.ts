import { readFileSync } from "node:fs";
import path from "node:path";

const stagePromptPath = (stageName: string) =>
  path.join(process.cwd(), "src", "lib", "campaign", "stages", stageName, "prompt.md");

const sharedPromptPath = (name: string) => path.join(process.cwd(), "src", "lib", "campaign", "shared", name);

export function readStagePrompt(stageName: string) {
  return readFileSync(stagePromptPath(stageName), "utf8").trim();
}

export function readSharedPrompt(name: string) {
  return readFileSync(sharedPromptPath(name), "utf8").trim();
}
