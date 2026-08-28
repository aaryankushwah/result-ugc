import { describe, expect, it } from "vitest";
import { launchpointCreatorDirectoryFromPosts } from "../src/integrations/launchpoint.js";

describe("Launchpoint creator directory fallback", () => {
  it("adds stable creator identities from posts when the creator endpoint is empty", () => {
    const creators = launchpointCreatorDirectoryFromPosts([], [
      { id: "post-1", creatorId: "creator-1", contractorName: "Avery" },
      { id: "post-2", creatorId: "creator-1", contractorName: "Duplicate" },
      { id: "post-3", creatorId: "creator-2" },
    ]);

    expect(creators).toEqual([
      expect.objectContaining({ externalId: "creator-1", displayName: "Avery" }),
      expect.objectContaining({ externalId: "creator-2", displayName: "creator-2" }),
    ]);
  });

  it("preserves richer creator endpoint records", () => {
    const creators = launchpointCreatorDirectoryFromPosts([
      { externalId: "creator-1", displayName: "Canonical", email: "creator@example.com", username: "canonical", sourceUrl: null },
    ], [{ id: "post-1", creatorId: "creator-1", contractorName: "Post name" }]);

    expect(creators).toEqual([
      expect.objectContaining({ externalId: "creator-1", displayName: "Canonical", email: "creator@example.com" }),
    ]);
  });
});
