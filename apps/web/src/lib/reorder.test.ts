import { describe, expect, it } from "vitest";
import { moveItem, moveItemRelative } from "./reorder";

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

describe("moveItemRelative", () => {
  it("waits until the pointer crosses the next card's midpoint", () => {
    expect(moveItemRelative(["views", "likes", "posts"], "views", "likes", "before")).toEqual(["views", "likes", "posts"]);
    expect(moveItemRelative(["views", "likes", "posts"], "views", "likes", "after")).toEqual(["likes", "views", "posts"]);
  });

  it("supports moving backward without jumping past the target", () => {
    expect(moveItemRelative(["views", "likes", "posts"], "posts", "likes", "after")).toEqual(["views", "likes", "posts"]);
    expect(moveItemRelative(["views", "likes", "posts"], "posts", "likes", "before")).toEqual(["views", "posts", "likes"]);
  });

  it("leaves unknown and same items alone", () => {
    expect(moveItemRelative(["views", "likes"], "views", "views", "after")).toEqual(["views", "likes"]);
    expect(moveItemRelative(["views", "likes"], "posts", "views", "before")).toEqual(["views", "likes"]);
  });
});
