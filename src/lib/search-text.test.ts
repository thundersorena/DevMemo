import { describe, expect, it } from "vitest";
import { buildSnippet, searchTerms } from "./search-text";

describe("searchTerms", () => {
  it("drops operators and keeps phrases", () => {
    expect(searchTerms('"webhook auth" OR telegram -draft')).toEqual(["webhook auth", "telegram"]);
  });
  it("ignores one-letter terms", () => {
    expect(searchTerms("a bc")).toEqual(["bc"]);
  });
});

describe("buildSnippet", () => {
  it("highlights all terms case-insensitively", () => {
    expect(buildSnippet("Fixed Webhook auth and webhook retries", ["webhook"])).toBe(
      "Fixed ⟦Webhook⟧ auth and ⟦webhook⟧ retries",
    );
  });
  it("centers long text on the first match", () => {
    const text = `${"x ".repeat(200)}needle ${"y ".repeat(200)}`;
    const snippet = buildSnippet(text, ["needle"], 20);
    expect(snippet.startsWith("… ")).toBe(true);
    expect(snippet.endsWith(" …")).toBe(true);
    expect(snippet).toContain("⟦needle⟧");
  });
  it("works with Persian text and regex characters", () => {
    expect(buildSnippet("بررسی وبهوک تلگرام", ["وبهوک"])).toBe("بررسی ⟦وبهوک⟧ تلگرام");
    expect(buildSnippet("cost is $5 (approx)", ["$5"])).toBe("cost is ⟦$5⟧ (approx)");
  });
});
