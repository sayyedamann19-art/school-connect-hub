import { describe, expect, it } from "vitest";
import { computeUnread } from "../unread";

describe("parent unread updates", () => {
  it("counts only published updates the parent hasn't read", () => {
    const rows = [
      { id: "a", is_published: true },
      { id: "b", is_published: true },
      { id: "c", is_published: false },
    ];
    expect(computeUnread(rows, ["a"]).map((r) => r.id)).toEqual(["b"]);
  });
  it("is empty once every published update is read", () => {
    expect(computeUnread([{ id: "a", is_published: true }], ["a"])).toHaveLength(0);
  });
});
