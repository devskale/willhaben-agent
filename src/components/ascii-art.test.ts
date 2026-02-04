import { describe, it, expect } from "vitest";
import {
  IMAGE_FRAME,
  SIMPLE_PLACEHOLDER,
  PHOTO_ICON,
  SMALL_FRAME,
  IMAGE_DOTS,
  createImageFrame,
  createImagePlaceholder,
  createSmallIcon,
  coloredImagePlaceholder,
  FULL_IMAGE_PREVIEW,
  IMAGE_COLORS,
} from "./ascii-art.js";

describe("ascii-art", () => {
  describe("IMAGE_FRAME constant", () => {
    it("should have frame structure", () => {
      expect(IMAGE_FRAME).toContain("┌");
      expect(IMAGE_FRAME).toContain("┐");
      expect(IMAGE_FRAME).toContain("│");
      expect(IMAGE_FRAME).toContain("└");
      expect(IMAGE_FRAME).toContain("┘");
    });

    it("should be multi-line", () => {
      expect(IMAGE_FRAME.split("\n").length).toBeGreaterThan(1);
    });
  });

  describe("SIMPLE_PLACEHOLDER constant", () => {
    it("should have bracketed structure", () => {
      expect(SIMPLE_PLACEHOLDER).toContain("╔═╗");
      expect(SIMPLE_PLACEHOLDER).toContain("╚═╝");
    });

    it("should contain IMG", () => {
      expect(SIMPLE_PLACEHOLDER).toContain("IMG");
    });
  });

  describe("PHOTO_ICON constant", () => {
    it("should have camera emoji", () => {
      expect(PHOTO_ICON).toContain("📷");
    });
  });

  describe("SMALL_FRAME constant", () => {
    it("should be compact with bullet", () => {
      expect(SMALL_FRAME).toContain("●");
    });
  });

  describe("createImageFrame function", () => {
    it("should return placeholder frame when hasImage is false", () => {
      const result = createImageFrame(false);
      expect(result).toContain("NO IMG");
      expect(result).toContain("┌");
      expect(result).toContain("┐");
    });

    it("should return frame when hasImage is true", () => {
      const result = createImageFrame(true);
      expect(result).toContain("┌");
      expect(result).toContain("┐");
      expect(result).toContain("│");
      expect(result).toContain("└");
      expect(result).toContain("┘");
    });
  });

  describe("createSmallIcon function", () => {
    it("should return camera icon when hasImage is true", () => {
      expect(createSmallIcon(true)).toBe("📷 ");
    });

    it("should return spaces when hasImage is false", () => {
      expect(createSmallIcon(false)).toBe("  ");
    });
  });

  describe("coloredImagePlaceholder function", () => {
    it("should return empty when hasImage is false", () => {
      expect(coloredImagePlaceholder(false)).toBe("");
    });

    it("should return colored frame when hasImage is true", () => {
      const result = coloredImagePlaceholder(true);
      expect(result).toContain("\x1b[36m"); // Cyan
      expect(result).toContain("\x1b[0m"); // Reset
    });
  });

  describe("createImagePlaceholder function", () => {
    it("should return empty for invalid dimensions", () => {
      expect(createImagePlaceholder(0, 4)).toBe("");
      expect(createImagePlaceholder(20, 0)).toBe("");
      expect(createImagePlaceholder(3, 4)).toBe("");
    });

    it("should create valid frame for valid dimensions", () => {
      const result = createImagePlaceholder(20, 4);
      const lines = result.split("\n");
      // height=4 means: top + 2 middle lines + bottom = 6 lines total
      expect(lines.length).toBe(6);
      expect(lines[0]).toMatch(/^┌─+┐$/);
      expect(lines[lines.length - 1]).toMatch(/^└─+┘$/);
    });

    it("should scale with width parameter", () => {
      const result = createImagePlaceholder(30, 4);
      const topLine = result.split("\n")[0];
      expect(topLine.length).toBeGreaterThan(20);
    });
  });

  describe("IMAGE_COLORS constant", () => {
    it("should have required color properties", () => {
      expect(IMAGE_COLORS).toHaveProperty("frame");
      expect(IMAGE_COLORS).toHaveProperty("icon");
      expect(IMAGE_COLORS).toHaveProperty("placeholder");
      expect(IMAGE_COLORS).toHaveProperty("reset");
    });

    it("should use ANSI escape codes", () => {
      expect(IMAGE_COLORS.frame).toMatch(/\x1b\[/);
    });
  });

  describe("rendering", () => {
    it("should work with component rendering", () => {
      const frame = createImageFrame(true);
      expect(() => JSON.stringify({ frame })).not.toThrow();
    });
  });
});
