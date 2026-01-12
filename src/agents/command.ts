import { FocusedSection } from "../types.js";
import {
  SearchHistoryItem,
  StarredItem,
  getSearchHistory,
  getStarredItems,
} from "./db.js";

export interface CommandContext {
  exit: () => void;
  setCommandInput: (input: string) => void;
  setFocusedSection: (section: FocusedSection) => void;
  setHistoryItems: (items: SearchHistoryItem[]) => void;
  setHistoryIndex: (index: number) => void;
  setStarredItemsList: (items: StarredItem[]) => void;
  setStarredIndex: (index: number) => void;
}

export type CommandAction = (context: CommandContext) => void;

export interface Command {
  name: string;
  description: string;
  action: CommandAction;
}

export const COMMANDS: Command[] = [
  {
    name: "/search",
    description: "Jump to search input",
    action: (ctx) => {
      ctx.setCommandInput("");
      ctx.setFocusedSection("search");
    },
  },
  {
    name: "/history",
    description: "View search history",
    action: (ctx) => {
      const history = getSearchHistory();
      ctx.setHistoryItems(history);
      ctx.setHistoryIndex(0);
      ctx.setFocusedSection("history");
      ctx.setCommandInput("");
    },
  },
  {
    name: "/starred",
    description: "View starred items",
    action: (ctx) => {
      const starred = getStarredItems();
      ctx.setStarredItemsList(starred);
      ctx.setStarredIndex(0);
      ctx.setFocusedSection("starred");
      ctx.setCommandInput("");
    },
  },
  {
    name: "/quit",
    description: "Exit the application",
    action: (ctx) => {
      ctx.exit();
    },
  },
];

export function getCommandNames(): string[] {
  return COMMANDS.map((c) => c.name);
}

export function executeCommand(
  commandName: string,
  context: CommandContext
): boolean {
  const cmd = COMMANDS.find((c) => c.name === commandName);
  if (cmd) {
    cmd.action(context);
    return true;
  }
  return false;
}
