import { describe, expect, it } from "vitest";
import { moveItem } from "./reorder";

describe("moveItem", () => {
  it("moves an item forward", () => {
    expect(moveItem(["views", "likes", "posts"], "views", "posts")).toEqual(["likes", "posts", "views"]);
  });

  it("moves an item backward", () => {
    expect(moveItem(["views", "likes", "posts"], "posts", "views")).toEqual(["posts", "views", "likes"]);
  });

  it("leaves unknown and same-position items alone", () => {
    expect(moveItem(["views", "posts"], "views", "views")).toEqual(["views", "posts"]);
    expect(moveItem(["views", "posts"], "likes", "views")).toEqual(["views", "posts"]);
  });
});
