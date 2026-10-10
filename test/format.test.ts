import { describe, expect, it } from "vitest";
import { formatMs, formatPercent, formatRequests, formatUsd } from "../src/lib/format.js";

describe("CostBadge formatting", () => {
  it("formats USD with two significant digits and a Polish decimal comma", () => {
    expect(formatUsd(0.00002016)).toBe("0,000020\u00a0$");
    expect(formatUsd(0.0123)).toBe("0,012\u00a0$");
    expect(formatUsd(0)).toBe("0\u00a0$");
  });

  it("formats milliseconds and percentages", () => {
    expect(formatMs(312.4)).toBe("312\u00a0ms");
    expect(formatPercent(0.964)).toBe("96%");
  });
});

describe("request count", () => {
  it("uses Polish plural forms", () => {
    expect(formatRequests(1)).toBe("1 zapytanie");
    expect(formatRequests(3)).toBe("3 zapytania");
    expect(formatRequests(5)).toBe("5 zapytań");
    expect(formatRequests(12)).toBe("12 zapytań");
    expect(formatRequests(22)).toBe("22 zapytania");
  });
});
