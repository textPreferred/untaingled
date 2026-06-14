import { describe, test, expect } from "bun:test";
import { parseDate, isValidDate } from "./dateValidation";

describe("parseDate", () => {
  test("parses year only", () => {
    expect(parseDate("2020")).toEqual({ year: "2020" });
  });

  test("parses year and month", () => {
    expect(parseDate("2020-3")).toEqual({ year: "2020", month: "3" });
  });

  test("parses full date", () => {
    expect(parseDate("2020-03-05")).toEqual({ year: "2020", month: "03", day: "05" });
  });

  test("returns null for non-dates", () => {
    expect(parseDate("garbage")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("2020-03-05-01")).toBeNull();
  });
});

describe("isValidDate", () => {
  test("accepts year, year-month, and full date", () => {
    expect(isValidDate("2020")).toBe(true);
    expect(isValidDate("2020-06")).toBe(true);
    expect(isValidDate("2020-06-15")).toBe(true);
  });

  test("accepts leap day in leap years, rejects it otherwise", () => {
    expect(isValidDate("2020-02-29")).toBe(true);
    expect(isValidDate("2021-02-29")).toBe(false);
  });

  test("rejects out-of-range months", () => {
    expect(isValidDate("2020-00")).toBe(false);
    expect(isValidDate("2020-13")).toBe(false);
  });

  test("rejects out-of-range days", () => {
    expect(isValidDate("2020-04-31")).toBe(false);
    expect(isValidDate("2020-01-00")).toBe(false);
  });

  test("rejects malformed input", () => {
    expect(isValidDate("notadate")).toBe(false);
  });
});
