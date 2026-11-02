import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware() {
      return this;
    },
    inputValidator() {
      return this;
    },
    handler(fn: unknown) {
      return fn;
    },
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { adminClassAttendanceRegister } from "../attendance-register.functions";

const state = {
  admin: true,
  permissionError: false,
  students: 1,
  failure: "",
  calls: [] as { table: string; conditions: [string, unknown][]; range: [number, number] | null }[],
};
beforeEach(() => {
  state.admin = true;
  state.permissionError = false;
  state.students = 1;
  state.failure = "";
  state.calls = [];
});
function sb() {
  return {
    rpc: async () => ({ data: state.admin, error: state.permissionError ? {} : null }),
    from(table: string) {
      const call = {
        table,
        conditions: [] as [string, unknown][],
        range: null as [number, number] | null,
      };
      state.calls.push(call);
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        eq(key: string, value: unknown) {
          call.conditions.push([key, value]);
          return q;
        },
        in(key: string, value: unknown) {
          call.conditions.push([key, value]);
          return q;
        },
        gte(key: string, value: unknown) {
          call.conditions.push([`from:${key}`, value]);
          return q;
        },
        lte(key: string, value: unknown) {
          call.conditions.push([`to:${key}`, value]);
          return q;
        },
        range(from: number, to: number) {
          call.range = [from, to];
          return q;
        },
        maybeSingle: async () => ({
          data: { id: "class-a", name: "Class 5", division: "A", academic_year: "2026-2027" },
          error: null,
        }),
        then(resolve: (value: unknown) => unknown) {
          let data: unknown[] = [];
          if (table === "students")
            data = Array.from({ length: state.students }, (_, i) => ({
              id: `s${i}`,
              full_name: `Child ${i}`,
              gr_number: `GR-${i}`,
              roll_number: String(i + 1),
              date_of_birth: null,
              mother_name: null,
              address: null,
              contact_number: null,
            }));
          if (table === "attendance") {
            const ids = call.conditions.find(([key]) => key === "student_id")![1] as string[];
            data = ids.flatMap((student_id) =>
              Array.from({ length: 31 }, (_, i) => ({
                student_id,
                date: `2026-10-${String(i + 1).padStart(2, "0")}`,
                status: "present",
              })),
            );
          }
          if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
          return Promise.resolve({ data, error: state.failure === table ? {} : null }).then(
            resolve,
          );
        },
      };
      return q;
    },
  };
}
const run = () =>
  (
    adminClassAttendanceRegister as unknown as (
      input: unknown,
    ) => Promise<{ rows: unknown[]; totals: { recorded: number } }>
  )({ data: { classId: "class-a", month: "2026-10" }, context: { supabase: sb() } });
it("denies parents and teachers before reading any class or student data", async () => {
  state.admin = false;
  await expect(run()).rejects.toThrow(/Only administrators/);
  expect(state.calls).toEqual([]);
});
it("fails closed when permission checking fails", async () => {
  state.permissionError = true;
  await expect(run()).rejects.toThrow(/Only administrators/);
  expect(state.calls).toEqual([]);
});
it("uses only the requested class, scoped student IDs and month without any write calls", async () => {
  await run();
  expect(
    state.calls
      .filter((c) => c.table === "students")
      .every((c) => c.conditions.some(([k, v]) => k === "class_id" && v === "class-a")),
  ).toBe(true);
  for (const c of state.calls.filter((c) => c.table === "attendance")) {
    expect(c.conditions).toContainEqual(["student_id", ["s0"]]);
    expect(c.conditions).toContainEqual(["from:date", "2026-10-01"]);
    expect(c.conditions).toContainEqual(["to:date", "2026-10-31"]);
  }
});
it("loads over 1000 attendance records and over 500 students without truncation", async () => {
  state.students = 501;
  const report = await run();
  expect(report.rows).toHaveLength(501);
  expect(report.totals.recorded).toBe(501 * 31);
  expect(state.calls.filter((c) => c.table === "students").map((c) => c.range)).toEqual([
    [0, 499],
    [500, 999],
  ]);
  expect(
    state.calls.filter((c) => c.table === "attendance").some((c) => c.range?.[0] === 3000),
  ).toBe(true);
});
it.each(["students", "attendance"])(
  "does not print a successful partial report after %s read failure",
  async (table) => {
    state.failure = table;
    await expect(run()).rejects.toThrow(/register was not generated/);
  },
);
it("handles a class with no students without reading attendance", async () => {
  state.students = 0;
  expect((await run()).rows).toEqual([]);
  expect(state.calls.some((c) => c.table === "attendance")).toBe(false);
});
