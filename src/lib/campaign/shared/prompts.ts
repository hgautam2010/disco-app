import { readFileSync } from "node:fs";
import path from "node:path";

const promptsRoot = path.join(process.cwd(), "prompts");

const stagePromptPath = (stageName: string) => path.join(promptsRoot, `${stageName}.md`);

const sharedPromptPath = (name: string) => path.join(promptsRoot, name);

export function readStagePrompt(stageName: string) {
  return readFileSync(stagePromptPath(stageName), "utf8").trim();
}

export function readSharedPrompt(name: string) {
  return readFileSync(sharedPromptPath(name), "utf8").trim();
}
