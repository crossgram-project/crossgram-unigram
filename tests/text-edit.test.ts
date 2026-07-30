import { describe, expect, it } from "vitest";

import { insertAfterOnce, replaceOnce } from "../src/core/text-edit.js";

describe("semantic text edits", () => {
  it("inserts once and preserves idempotency", () => {
    const first = insertAfterOnce("a\nb\n", "a", "\nx", "x", "sample");
    expect(first).toBe("a\nx\nb\n");
    expect(insertAfterOnce(first, "a", "\nx", "x", "sample")).toBe(first);
  });

  it("rejects ambiguous anchors", () => {
    expect(() => replaceOnce("a a", "a", "b", "missing", "sample")).toThrow(/ambiguous/);
  });
});
