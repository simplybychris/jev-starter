import { describe, expect, it } from "vitest";
import { formatMs, formatPercent, formatRequests, formatUsd } from "../src/lib/format.js";

describe("CostBadge formatting", () => {
  it("formats USD with two significant digits", () => {
    expect(formatUsd(0.00002016)).toBe("$0.000020");
    expect(formatUsd(0.0123)).toBe("$0.012");
    expect(formatUsd(0)).toBe("$0");
  });

  it("formats milliseconds and percentages", () => {
    expect(formatMs(312.4)).toBe("312\u00a0ms");
    expect(formatPercent(0.964)).toBe("96%");
  });
});

describe("request count", () => {
  it("uses singular and plural", () => {
    expect(formatRequests(1)).toBe("1 request");
    expect(formatRequests(3)).toBe("3 requests");
  });
});
