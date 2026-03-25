#!/usr/bin/env node
import { checkAuth } from "./agents/auth.js";
import { searchItems, getListingDetails, getSeller, getCategoryTree } from "./agents/search.js";
import { FALLBACK_LOCATIONS } from "./agents/locations.js";
import {
  getStarredItems,
  toggleStar,
  getSearchHistory,
  addSearchHistory,
} from "./agents/db.js";
import { sendMessage, getConversations, getMessages } from "./agents/messaging.js";

const COMMANDS = {
  search: "Search for listings (returns items + categories)",
  tree: "Browse category tree (optional: category ID to drill down)",
  locations: "List Austrian states (Bundesländer) for location filtering",
  view: "View listing details",
  seller: "Get seller info",
  auth: "Check authentication status",
  message: "Send a message to a seller (requires authentication)",
  chats: "List conversations or view messages (optional: conversation UUID)",
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
  
  // Parse location IDs (comma-separated)
  let areaIds: number[] | undefined;
  if (typeof flags.location === "string") {
    areaIds = flags.location
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }

  try {
    const result = await searchItems(query, category, page, areaIds);

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
  const useCDP = flags.cdp === true;

  try {
    const auth = await checkAuth(useCDP);
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

async function cmdTree(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const categoryId = positional[0];
  const keyword = typeof flags.keyword === "string" ? flags.keyword : undefined;

  try {
    const tree = await getCategoryTree(categoryId, keyword);
    output(tree, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch category tree" }, format);
    process.exit(1);
  }
}

function cmdLocations(format: OutputFormat) {
  const locations = Object.entries(FALLBACK_LOCATIONS).map(([id, name]) => ({
    id: Number(id),
    name,
  }));
  output(locations, format);
}

async function cmdMessage(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adId = positional[0];
  const message = positional.slice(1).join(" ");

  if (!adId) {
    output({ error: "Missing listing ID. Usage: whcli message <adId> <message>" }, format);
    process.exit(1);
  }

  if (!message) {
    output({ error: "Missing message. Usage: whcli message <adId> <message>" }, format);
    process.exit(1);
  }

  try {
    const result = await sendMessage({
      adId,
      message,
      copyToSender: flags["copy"] === true,
      showPhone: flags["show-phone"] === true,
      phone: typeof flags.phone === "string" ? flags.phone : undefined,
    });

    output(result, format);

    if (!result.success) {
      process.exit(1);
    }
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to send message" }, format);
    process.exit(1);
  }
}

async function cmdChats(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const conversationId = positional[0];

  try {
    // If conversation ID provided, get messages for that conversation
    if (conversationId) {
      const conversation = await getMessages(conversationId);
      output(conversation, format);
      return;
    }

    // Otherwise, list all conversations
    const result = await getConversations();
    
    if (!result.success) {
      output({ error: result.error }, format);
      process.exit(1);
    }

    // Simplify output for readability
    const simplified = result.conversations.map((c) => ({
      id: c.id,
      partner: c.partnerName,
      adTitle: c.adTitle,
      adId: c.adId,
      adStatus: c.adStatus,
      price: c.adPrice,
      lastMessage: c.lastMessage?.message?.substring(0, 100),
      lastMessageAt: c.lastMessage?.timestamp,
      isMine: c.lastMessage?.isMine,
      unseen: c.unseen,
    }));

    output({ total: result.total, conversations: simplified }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch chats" }, format);
    process.exit(1);
  }
}

function cmdHelp(format: OutputFormat) {
  const help = {
    name: "whcli",
    description: "Willhaben.at CLI for agent automation",
    commands: Object.entries(COMMANDS).map(([name, desc]) => ({ name, description: desc })),
    examples: [
      "whcli tree                          # Root categories",
      "whcli tree 2691                     # Drill into Smartphones/Telefonie",
      "whcli tree 2691 --keyword pixel     # Categories filtered by 'pixel'",
      "whcli locations                     # List Austrian states",
      "whcli search 'pixel' --location 900,1,3  # Search in Wien, Burgenland, NÖ",
      "whcli search 'pixel' --category 5014402  # Search in Google category",
      "whcli view 12345678",
      "whcli seller abc123",
      "whcli auth                          # Check auth (sweet-cookie)",
      "whcli auth --cdp                    # Check auth (Chrome DevTools)",
      "whcli message 12345678 'Hallo, ist das noch verfügbar?'",
      "whcli chats                         # List all conversations",
      "whcli chats <uuid>                  # View messages in a conversation",
      "whcli favorites list",
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
    case "tree":
      await cmdTree(positional, flags, format);
      break;
    case "locations":
      cmdLocations(format);
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
    case "message":
      await cmdMessage(positional, flags, format);
      break;
    case "chats":
      await cmdChats(positional, flags, format);
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
