import { describe, expect, it } from "vitest";
import { stageLocalWarnings, uniqueWarnings } from "@/lib/campaign/shared/warnings";

describe("campaign warning helpers", () => {
  it("keeps final warning lists unique and non-empty", () => {
    expect(uniqueWarnings(["", "  Keep this.  ", "Keep this.", "Add this."])).toEqual([
      "Keep this.",
      "Add this."
    ]);
  });

  it("keeps pipeline trace warnings local to the stage", () => {
    expect(
      stageLocalWarnings(
        ["Catalog is directional.", "Dropped invalid publisher.", "Catalog is directional."],
        ["Catalog is directional."]
      )
    ).toEqual(["Dropped invalid publisher."]);
  });
});
