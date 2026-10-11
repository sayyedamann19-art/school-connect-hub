import { describe, expect, it } from "vitest";
import {
  canRun,
  exactIlike,
  isLockedOut,
  isManageableParent,
  teacherMayWriteRow,
} from "../account-rules";

describe("account service permissions", () => {
  it("only admins may create teachers, suspend, change passwords or contacts", () => {
    for (const action of [
      "create_teacher",
      "create_student",
      "set_parent_active",
      "set_parent_password",
      "change_parent_contact",
    ] as const) {
      expect(canRun(action, ["teacher"])).toBe(false);
      expect(canRun(action, ["parent"])).toBe(false);
      expect(canRun(action, ["admin"])).toBe(true);
    }
  });
  it("teachers may import, parents may not", () => {
    expect(canRun("import_rows", ["teacher"])).toBe(true);
    expect(canRun("import_rows", ["parent"])).toBe(false);
  });
  it("suspend/password changes never target staff accounts", () => {
    expect(isManageableParent(["parent"])).toBe(true);
    expect(isManageableParent(["parent", "admin"])).toBe(false);
    expect(isManageableParent(["teacher"])).toBe(false);
    expect(isManageableParent([])).toBe(false);
  });
  it("teacher import is limited to their own classes", () => {
    const mine = new Set(["c1"]);
    const base = { isAdmin: false, teacherClassIds: mine, existingStudent: false, existingStudentClassId: null };
    expect(teacherMayWriteRow({ ...base, targetClassId: "c1" })).toBe(true);
    expect(teacherMayWriteRow({ ...base, targetClassId: "c2" })).toBe(false);
    expect(
      teacherMayWriteRow({ ...base, targetClassId: "c1", existingStudent: true, existingStudentClassId: "c2" }),
    ).toBe(false);
  });
  it("GR sign-in locks after 5 failures", () => {
    expect(isLockedOut(4)).toBe(false);
    expect(isLockedOut(5)).toBe(true);
  });
  it("GR lookup escapes wildcards", () => {
    expect(exactIlike("12%_")).toBe("12\\%\\_");
  });
});

import { soleParentStudents as sole } from "@/lib/account-rules";
describe("deleting a parent", () => {
  it("flags only students with no other parent", () => {
    const r = sole([{ id: "a", otherParents: 0 }, { id: "b", otherParents: 1 }]);
    expect(r.map((s) => s.id)).toEqual(["a"]);
  });
});
