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
  const top = "─".repeat(width - 2);
  const side = "│";
  const middle = " ".repeat(width - 2);
  const bottom = "─".repeat(width - 2);

  return `
┌${top}┐
${side}${middle}${side}
${side}${middle}${side}
└${bottom}┘`;
}

export function createImageFrame(hasImage: boolean): string {
  if (!hasImage) return "";

  return `
 ┌──────────────┐
 │              │
 │   [ 📷 IMG]  │
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
