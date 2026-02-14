import { describe, it, expect } from "vitest";
import { confidenceToColor } from "./colors";

describe("confidenceToColor", () => {
  it("returns gray for 0", () => {
    expect(confidenceToColor(0)).toBe("gray");
  });

  it("returns red for 0.01", () => {
    expect(confidenceToColor(0.01)).toBe("red");
  });

  it("returns red for 0.39", () => {
    expect(confidenceToColor(0.39)).toBe("red");
  });

  it("returns yellow for 0.4", () => {
    expect(confidenceToColor(0.4)).toBe("yellow");
  });

  it("returns yellow for 0.69", () => {
    expect(confidenceToColor(0.69)).toBe("yellow");
  });

  it("returns green for 0.7", () => {
    expect(confidenceToColor(0.7)).toBe("green");
  });

  it("returns green for 1.0", () => {
    expect(confidenceToColor(1.0)).toBe("green");
  });
});
