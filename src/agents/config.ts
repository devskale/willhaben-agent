// User Configuration for Willhaben TUI
// Settings are stored in ~/.config/willhaben/config.json

export interface UserConfig {
  asciiWidth: 80 | 100 | 120 | "auto";           // Width for ASCII image rendering
  asciiContrast: "low" | "medium" | "high" | "rotate";  // ASCII character gradient
  preferredLocation?: number;  // Preferred location area ID
}

export const DEFAULT_CONFIG: UserConfig = {
  asciiWidth: "auto",
  asciiContrast: "rotate",
};

export const VALID_ASCII_WIDTHS = [80, 100, 120, "auto"] as const;
export const VALID_ASCII_CONTRASTS = ["low", "medium", "high", "rotate"] as const;

// ASCII character sets for different contrast levels
export const ASCII_CHAR_SETS = {
  low: " ░▒▓█",       // Subtle, fewer levels
  medium: " .·░▒▓█", // Default gradient
  high: " .·░▒▓█#@", // Bold, more levels
} as const;

// Austrian Bundesländer location mapping
export const LOCATIONS: Record<number, string> = {
  1: "Burgenland",
  2: "Kärnten",
  3: "Niederösterreich",
  4: "Oberösterreich",
  5: "Salzburg",
  6: "Steiermark",
  7: "Tirol",
  8: "Vorarlberg",
  900: "Wien",
};

export const LOCATION_IDS = Object.keys(LOCATIONS).map(Number);

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Use local .willhaben folder in project directory
const CONFIG_DIR = join(process.cwd(), ".willhaben");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

async function ensureConfigDir() {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function getConfig(): Promise<UserConfig> {
  await ensureConfigDir();

  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content) as Partial<UserConfig>;

    // Validate width (handle both number and "auto" string)
    const width = config.asciiWidth;
    let validWidth: 80 | 100 | 120 | "auto";
    if (width === "auto" || (typeof width === "number" && VALID_ASCII_WIDTHS.includes(width as any))) {
      validWidth = width as 80 | 100 | 120 | "auto";
    } else {
      validWidth = DEFAULT_CONFIG.asciiWidth;
    }

    // Validate contrast
    const contrast = config.asciiContrast;
    const validContrast = VALID_ASCII_CONTRASTS.includes(contrast as any)
      ? contrast as "low" | "medium" | "high" | "rotate"
      : DEFAULT_CONFIG.asciiContrast;

    // Validate location
    let validLocation: number | undefined = config.preferredLocation;
    if (validLocation !== undefined && !LOCATION_IDS.includes(validLocation)) {
      validLocation = undefined;
    }

    return {
      asciiWidth: validWidth,
      asciiContrast: validContrast,
      preferredLocation: validLocation,
    };
  } catch {
    // Config doesn't exist or is invalid, return defaults
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(updates: Partial<UserConfig>): Promise<UserConfig> {
  await ensureConfigDir();

  const current = await getConfig();
  const merged = { ...current, ...updates };

  await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2));

  return merged;
}

export function isValidAsciiWidth(value: unknown): value is 80 | 100 | 120 | "auto" {
  return VALID_ASCII_WIDTHS.includes(value as any);
}
