import { describe, expect, it } from "vitest";
import { assetLabelFromFileName, safeAssetFileName, scriptAssetKindFromContentType } from "./script-asset-upload";

describe("script asset uploads", () => {
  it("classifies images, GIFs, and videos", () => {
    expect(scriptAssetKindFromContentType("image/gif")).toBe("image");
    expect(scriptAssetKindFromContentType("video/mp4")).toBe("video");
    expect(scriptAssetKindFromContentType("application/pdf")).toBeNull();
  });

  it("creates safe storage paths and readable labels", () => {
    expect(safeAssetFileName("Final cut (v2).mp4")).toBe("Final-cut-v2.mp4");
    expect(assetLabelFromFileName("product-demo_final.gif")).toBe("product demo final");
  });
});
