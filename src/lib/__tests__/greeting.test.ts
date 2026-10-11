import { describe, expect, it } from "vitest";
import { greetingFor } from "../greeting";

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

describe("greetingFor", () => {
  it("morning 5:00–11:59", () => {
    expect(greetingFor(at(5))).toBe("Good morning");
    expect(greetingFor(at(11, 59))).toBe("Good morning");
  });
  it("afternoon 12:00–4:59 PM", () => {
    expect(greetingFor(at(12))).toBe("Good afternoon");
    expect(greetingFor(at(16, 59))).toBe("Good afternoon");
  });
  it("evening 5:00–8:59 PM", () => {
    expect(greetingFor(at(17))).toBe("Good evening");
    expect(greetingFor(at(20, 59))).toBe("Good evening");
  });
  it("night 9:00 PM–4:59 AM", () => {
    expect(greetingFor(at(21))).toBe("Good night");
    expect(greetingFor(at(4, 59))).toBe("Good night");
  });
});
