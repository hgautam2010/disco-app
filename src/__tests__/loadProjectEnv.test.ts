import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProjectEnv } from "@/lib/env/loadProjectEnv";

const envKeys = ["SCRIPT_ENV_TEST_VALUE", "SCRIPT_ENV_LOCAL_ONLY"] as const;

describe("loadProjectEnv", () => {
  afterEach(() => {
    for (const key of envKeys) {
      delete process.env[key];
    }
    vi.unstubAllEnvs();
  });

  it("loads .env and .env.local for standalone scripts", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "disco-env-"));

    try {
      writeFileSync(path.join(projectDir, ".env"), "SCRIPT_ENV_TEST_VALUE=from-env\n");
      writeFileSync(
        path.join(projectDir, ".env.local"),
        "SCRIPT_ENV_TEST_VALUE=from-local\nSCRIPT_ENV_LOCAL_ONLY=present\n"
      );

      for (const key of envKeys) {
        delete process.env[key];
      }
      vi.stubEnv("NODE_ENV", "development");

      const result = loadProjectEnv(projectDir);

      expect(result.loadedFiles.some((file) => file.endsWith(".env"))).toBe(true);
      expect(result.loadedFiles.some((file) => file.endsWith(".env.local"))).toBe(true);
      expect(process.env.SCRIPT_ENV_TEST_VALUE).toBe("from-local");
      expect(process.env.SCRIPT_ENV_LOCAL_ONLY).toBe("present");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
