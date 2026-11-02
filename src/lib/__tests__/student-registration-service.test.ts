import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin",
  student: null as Record<string, unknown> | null,
  writes: [] as { table: string; value: Record<string, unknown> }[],
  parentLookups: [] as string[],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: async () => ({ data: { user: { id: "caller" } }, error: null }) },
    from(table: string) {
      let data: unknown =
        table === "user_roles"
          ? [{ role: state.role }]
          : table === "classes"
            ? [{ id: "class-a", name: "Class 5", division: "A" }]
            : table === "teachers"
              ? { id: "teacher-a" }
              : table === "class_teachers"
                ? [{ class_id: "class-a" }]
                : null;
      const q = {
        select() {
          return q;
        },
        eq(key: string, value: string) {
          if (table === "user_roles" && key === "user_id" && value === "parent-a")
            data = [{ role: "parent" }];
          return q;
        },
        ilike() {
          data = state.student;
          return q;
        },
        limit() {
          return q;
        },
        or(filter: string) {
          state.parentLookups.push(filter);
          data = { id: "parent-a" };
          return q;
        },
        insert(value: Record<string, unknown>) {
          state.writes.push({ table, value });
          data = { id: "new-student" };
          return q;
        },
        update(value: Record<string, unknown>) {
          state.writes.push({ table, value });
          return q;
        },
        upsert(value: Record<string, unknown>) {
          state.writes.push({ table, value });
          return q;
        },
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return q;
    },
  },
}));

import { executeAccountAction } from "../account-admin.server";
const details = {
  fullName: "Child A",
  grNumber: "GR-100",
  rollNumber: "007",
  dateOfBirth: "2017-05-12",
  motherName: "Mother A",
  address: "Nashik",
  contactNumber: "9876543210",
};
const importRow = {
  ...details,
  rowNumber: 2,
  className: "Class 5",
  division: "A",
  heightCm: null,
  weightKg: null,
  parentName: "Guardian A",
  parentPhone: "9123456780",
};
const run = (action: "create_student" | "import_rows", payload: unknown) =>
  executeAccountAction(action, payload, "test.token.value", null);

beforeEach(() => {
  state.role = "admin";
  state.student = null;
  state.writes = [];
  state.parentLookups = [];
});
it("manual creation saves new details on the student without creating a parent login", async () => {
  await expect(run("create_student", details)).resolves.toMatchObject({ ok: true });
  expect(state.writes).toEqual([
    {
      table: "students",
      value: expect.objectContaining({
        mother_name: "Mother A",
        address: "Nashik",
        contact_number: "9876543210",
        date_of_birth: "2017-05-12",
        roll_number: "007",
      }),
    },
  ]);
  expect(state.parentLookups).toEqual([]);
});
it("rejects a direct API request missing required student details before writing", async () => {
  await expect(run("create_student", { ...details, motherName: "" })).rejects.toThrow();
  expect(state.writes).toEqual([]);
});
it("keeps the existing manual-create admin restriction", async () => {
  state.role = "teacher";
  await expect(run("create_student", details)).rejects.toThrow();
  expect(state.writes).toEqual([]);
});
it("import writes student details and continues matching parent by the separate login phone", async () => {
  const result = await run("import_rows", { academicYear: "2026-2027", rows: [importRow] });
  expect(result).toMatchObject({ results: [{ outcome: "created" }] });
  expect(state.writes.find((w) => w.table === "students")!.value).toMatchObject({
    mother_name: "Mother A",
    contact_number: "9876543210",
    date_of_birth: "2017-05-12",
  });
  expect(state.parentLookups[0]).toContain("9123456780");
  expect(state.parentLookups[0]).not.toContain("9876543210");
});
it("teacher import rejects a student's GR when it belongs to another class", async () => {
  state.role = "teacher";
  state.student = { id: "child-b", class_id: "class-b" };
  const result = await run("import_rows", { academicYear: "2026-2027", rows: [importRow] });
  expect(result).toMatchObject({
    results: [{ outcome: "failed", message: expect.stringContaining("outside your classes") }],
  });
  expect(state.writes).toEqual([]);
});
