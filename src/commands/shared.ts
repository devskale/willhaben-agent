/**
 * Shared types and helpers for command handlers.
 */

export type OutputFormat = 'json' | 'text';

export function output(data: unknown, format: OutputFormat) {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

export function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0] || 'help', positional: positional.slice(1), flags };
}

export function getFormat(flags: Record<string, string | boolean>): OutputFormat {
  if (flags.json === true) return 'json';
  if (flags.text === true) return 'text';
  return 'json';
}
