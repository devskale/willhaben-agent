#!/usr/bin/env node
import { checkAuth } from "./agents/auth.js";
import { searchItems, getListingDetails, getSeller } from "./agents/search.js";
import {
  getStarredItems,
  toggleStar,
  getSearchHistory,
  addSearchHistory,
} from "./agents/db.js";

const COMMANDS = {
  search: "Search for listings",
  view: "View listing details",
  seller: "Get seller info",
  auth: "Check authentication status",
  favorites: "Manage favorites (list/add/remove)",
  history: "Show search history",
  help: "Show this help",
};

type OutputFormat = "json" | "text";

function output(data: unknown, format: OutputFormat) {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0] || "help", positional: positional.slice(1), flags };
}

function getFormat(flags: Record<string, string | boolean>): OutputFormat {
  if (flags.json === true) return "json";
  if (flags.text === true) return "text";
  return "json"; // Default to JSON for agent consumption
}

async function cmdSearch(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const query = positional.join(" ");
  if (!query) {
    output({ error: "Missing search query" }, format);
    process.exit(1);
  }

  const page = typeof flags.page === "string" ? parseInt(flags.page, 10) : 1;
  const category = typeof flags.category === "string" ? flags.category : undefined;

  try {
    const result = await searchItems(query, category, page);

    // Record in history
    try {
      addSearchHistory(query, category);
    } catch {
      // Ignore history errors
    }

    output(result, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Search failed" }, format);
    process.exit(1);
  }
}

async function cmdView(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adId = positional[0];
  if (!adId) {
    output({ error: "Missing listing ID" }, format);
    process.exit(1);
  }

  try {
    const detail = await getListingDetails(adId);
    output(detail, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch listing" }, format);
    process.exit(1);
  }
}

async function cmdSeller(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const sellerId = positional[0];
  if (!sellerId) {
    output({ error: "Missing seller ID" }, format);
    process.exit(1);
  }

  try {
    const seller = await getSeller(sellerId);
    output(seller, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch seller" }, format);
    process.exit(1);
  }
}

async function cmdAuth(flags: Record<string, string | boolean>, format: OutputFormat) {
  try {
    const auth = await checkAuth();
    output(
      {
        authenticated: auth.isAuthenticated,
        user: auth.user,
        error: auth.error,
      },
      format
    );
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Auth check failed" }, format);
    process.exit(1);
  }
}

async function cmdFavorites(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const subcommand = positional[0] || "list";

  if (subcommand === "list") {
    const items = getStarredItems();
    output(items, format);
    return;
  }

  if (subcommand === "add" || subcommand === "remove") {
    const listingJson = flags.data;
    if (typeof listingJson !== "string") {
      output({ error: "Missing --data with listing JSON" }, format);
      process.exit(1);
    }

    try {
      const listing = JSON.parse(listingJson);
      const isAdd = subcommand === "add";
      const currentlyStarred = toggleStar(listing);

      if (isAdd && !currentlyStarred) {
        // toggleStar returned false meaning it was already unstarred and we just added it
        output({ success: true, action: "added", id: listing.id }, format);
      } else if (!isAdd && currentlyStarred) {
        // toggleStar returned true meaning it was starred and we just removed it
        output({ success: true, action: "removed", id: listing.id }, format);
      } else {
        output({ success: true, action: isAdd ? "already-added" : "already-removed", id: listing.id }, format);
      }
    } catch (e) {
      output({ error: "Invalid listing JSON" }, format);
      process.exit(1);
    }
    return;
  }

  output({ error: `Unknown favorites subcommand: ${subcommand}` }, format);
  process.exit(1);
}

function cmdHistory(format: OutputFormat) {
  const history = getSearchHistory();
  output(history, format);
}

function cmdHelp(format: OutputFormat) {
  const help = {
    name: "whcli",
    description: "Willhaben.at CLI for agent automation",
    commands: Object.entries(COMMANDS).map(([name, desc]) => ({ name, description: desc })),
    examples: [
      "whcli search 'iphone 15' --json",
      "whcli search 'macbook' --category 880 --page 2",
      "whcli view 12345678",
      "whcli seller abc123",
      "whcli auth",
      "whcli favorites list",
      "whcli favorites add --data '{\"id\":\"123\",\"title\":\"...\",...}'",
      "whcli history",
    ],
  };
  output(help, format);
}

async function main() {
  const args = process.argv.slice(2);
  const { command, positional, flags } = parseArgs(args);
  const format = getFormat(flags);

  switch (command) {
    case "search":
      await cmdSearch(positional, flags, format);
      break;
    case "view":
      await cmdView(positional, flags, format);
      break;
    case "seller":
      await cmdSeller(positional, flags, format);
      break;
    case "auth":
      await cmdAuth(flags, format);
      break;
    case "favorites":
      await cmdFavorites(positional, flags, format);
      break;
    case "history":
      cmdHistory(format);
      break;
    case "help":
    case "--help":
    case "-h":
      cmdHelp(format);
      break;
    default:
      output({ error: `Unknown command: ${command}. Use 'whcli help' for usage.` }, format);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
