import { describe, expect, it } from "vitest";
import { formatMs, formatPercent, formatUsd } from "../src/lib/format.js";

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
