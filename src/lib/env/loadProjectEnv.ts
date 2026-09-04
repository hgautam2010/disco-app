import { loadEnvConfig } from "@next/env";

export type LoadedProjectEnv = {
  loadedFiles: string[];
};

export function loadProjectEnv(projectDir = process.cwd()): LoadedProjectEnv {
  const result = loadEnvConfig(projectDir, process.env.NODE_ENV !== "production", undefined, true);

  return {
    loadedFiles: result.loadedEnvFiles.map((file) => file.path)
  };
}
