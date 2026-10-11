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

import { staffInboxFilter } from "../unread";

describe("staff inbox", () => {
  const rows = [
    { id: "t1", is_published: true, created_by: "teacherA" },
    { id: "a1", is_published: true, created_by: "admin1" },
    { id: "d1", is_published: false, created_by: "admin1" },
    { id: "own", is_published: true, created_by: "teacherB" },
  ];
  const senders = new Map([["t1", false], ["a1", true], ["d1", true], ["own", false]]);
  it("teacher update goes to admin only", () => {
    expect(staffInboxFilter(rows, senders, "admin1", "admin").map((r) => r.id)).toEqual(["t1", "own"]);
  });
  it("admin update goes to active teachers, excluding drafts and own", () => {
    expect(staffInboxFilter(rows, senders, "teacherB", "teacher").map((r) => r.id)).toEqual(["a1"]);
  });
  it("inactive teachers get nothing", () => {
    expect(staffInboxFilter(rows, senders, "teacherB", "teacher", false)).toEqual([]);
  });
  it("republishing keeps one entry that stays read", () => {
    const list = staffInboxFilter([...rows], senders, "teacherB", "teacher");
    expect(computeUnread(list, ["a1"])).toHaveLength(0);
  });
});
