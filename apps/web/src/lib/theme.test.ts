import { describe, expect, it } from "vitest";
import { isTheme, nextTheme, themeCookie, themeFromCookie } from "./theme";

describe("workspace theme", () => {
  it("toggles between the supported themes", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("rejects unsupported persisted values", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("reads and writes the persistent theme cookie", () => {
    expect(themeFromCookie("session=one; result-theme=dark; other=two")).toBe("dark");
    expect(themeFromCookie("result-theme=system")).toBeNull();
    expect(themeCookie("light")).toContain("result-theme=light");
  });
});
