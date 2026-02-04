// ASCII Art Previews for product images

export const IMAGE_FRAME = `
┌────────────────────┐
│                  │
│     [IMAGE]     │
│                  │
└────────────────────┘
`;

export const SIMPLE_PLACEHOLDER = `
  ╔═╗
  ║IMG╠╣
  ╚═╝
`;

export const PHOTO_ICON = `
  ┌───┐
  │ 📷 │
  └───┘
`;

export const SMALL_FRAME = `
┌───┐
│ ● │
└───┘
`;

export const IMAGE_DOTS = `
  .       .
 .  . .  .
  . . . .
`;

export function createImagePlaceholder(width: number = 20, height: number = 4): string {
  // Handle edge cases
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  
  // For very small dimensions, return minimal or empty
  if (safeWidth < 4 || safeHeight < 2) {
    return "";
  }
  
  const top = "─".repeat(safeWidth - 2);
  const side = "│";
  const middle = " ".repeat(safeWidth - 2);
  
  // Create the middle lines based on height
  const middleLineCount = Math.max(0, safeHeight - 2);
  const middleLines = Array(middleLineCount)
    .fill(`${side}${middle}${side}`)
    .join("\n");
  
  return `┌${top}┐
${side}${middle}${side}
${middleLines}
${side}${middle}${side}
└${top}┘`;
}

export function createImageFrame(hasImage: boolean): string {
  if (hasImage) {
    return `
 ┌──────────────┐
 │              │
 │   [ 📷 IMG]  │
 │              │
 └──────────────┘`;
  }

  // Return placeholder frame for products without images
  return `
 ┌──────────────┐
 │              │
 │  [ NO IMG ]  │
 │              │
 └──────────────┘`;
}

// Color codes for terminal
export const IMAGE_COLORS = {
  frame: "\x1b[36m", // Cyan
  icon: "\x1b[33m", // Yellow
  placeholder: "\x1b[90m", // Gray
  reset: "\x1b[0m", // Reset
} as const;

export function coloredImagePlaceholder(
  hasImage: boolean
): string {
  if (!hasImage) return "";

  const { frame, icon, placeholder, reset } = IMAGE_COLORS;

  return `${frame}${IMAGE_FRAME}${reset}`;
}

export function createSmallIcon(hasImage: boolean): string {
  if (!hasImage) return "  ";
  return "📷 ";
}

export const FULL_IMAGE_PREVIEW = `
┌──────────────────────────────────────┐
│                                      │
│       ┌─────────────────────┐        │
│       │  ░░░▒▒▓▓▒▒░░░░░░  │        │
│       │  ▒▓██████████▓▒░▒▒▓  │        │
│       │  ░▒████████████▓▒▒░░▒  │        │
│       │  ░▒▓████████████▓▒▒░▒▓  │        │
│       │  ░░▒▓██████████▓▒░░▒░  │        │
│       │  ░░░▒▒▓▓▓▒▒░░░░░░  │        │
│       └─────────────────────┘        │
│                                      │
└──────────────────────────────────────┘
`;
