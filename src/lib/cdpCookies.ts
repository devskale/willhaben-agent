/**
 * Chrome DevTools Protocol (CDP) cookie extractor using Puppeteer.
 * Connects to a running Chrome instance via CDP to get cookies, bypassing v20 encryption.
 *
 * Setup:
 * 1. Enable remote debugging in Chrome: chrome://inspect/#remote-debugging -> Turn on
 * 2. Or launch Chrome with: chrome.exe --remote-debugging-port=9222
 */

import puppeteer from 'puppeteer-core';

const CDP_PORT = 9222;

// Chrome paths - used when launching a new browser
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// Chrome paths - cross-platform
const CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE || (
  isMac
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : isWin
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome'
);
const CHROME_USER_DATA = process.env.CHROME_USER_DATA || (
  isMac
    ? `${process.env.HOME}/Library/Application Support/Google/Chrome`
    : isWin
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`
      : `${process.env.HOME}/.config/google-chrome`
);
const CHROME_PROFILE = process.env.CHROME_PROFILE || 'Default';

export interface CDPCookieOptions {
  /** URLs to get cookies for */
  urls: string[];
  /** Cookie names to filter (optional, returns all if not specified) */
  names?: string[];
  /** Use CDP connection (connect to running browser) vs launch new browser */
  useConnection?: boolean;
}

export interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

/**
 * Extract cookies from Chrome via CDP.
 *
 * Option 1: Connect to running Chrome with remote debugging enabled
 *           (chrome://inspect/#remote-debugging -> Turn on)
 *
 * Option 2: Close Chrome, then this will launch it with the profile
 */
export async function getCookiesViaCDP(options: CDPCookieOptions): Promise<{
  cookies: CDPCookie[];
  error?: string;
}> {
  const { urls, names, useConnection = true } = options;

  let browser: puppeteer.Browser | null = null;
  let launched = false;

  try {
    // Try to connect to existing Chrome instance first
    if (useConnection) {
      try {
        browser = await puppeteer.connect({
          browserURL: `http://127.0.0.1:${CDP_PORT}`,
        });
      } catch {
        // Connection failed, will try launching instead
      }
    }

    // If connection failed, launch Chrome with profile
    if (!browser) {
      const { existsSync } = await import('node:fs');
      const { copyFileSync, mkdirSync, mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const tempProfileDir = mkdtempSync(join(tmpdir(), 'chrome-cdp-'));

      // Copy profile data to temp directory (cookies, Local State)
      const defaultProfile = join(CHROME_USER_DATA, CHROME_PROFILE);
      const tempDefaultProfile = join(tempProfileDir, CHROME_PROFILE);

      if (existsSync(defaultProfile)) {
        mkdirSync(tempDefaultProfile, { recursive: true });

        const filesToCopy = [
          'Cookies',
          'Cookies-journal',
          join('Network', 'Cookies'),
          join('Network', 'Cookies-journal'),
        ];

        for (const file of filesToCopy) {
          const src = join(defaultProfile, file);
          const dst = join(tempDefaultProfile, file);
          if (existsSync(src)) {
            try {
              const parentDir = join(tempDefaultProfile, file.split(/[\\\/]/).slice(0, -1).join('/'));
              if (!existsSync(parentDir)) {
                mkdirSync(parentDir, { recursive: true });
              }
              copyFileSync(src, dst);
            } catch {
              // Ignore copy errors
            }
          }
        }
      }

      const localStateSrc = join(CHROME_USER_DATA, 'Local State');
      const localStateDst = join(tempProfileDir, 'Local State');
      if (existsSync(localStateSrc)) {
        copyFileSync(localStateSrc, localStateDst);
      }

      browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE,
        headless: true,
        userDataDir: tempProfileDir,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--disable-sync',
          '--disable-gpu',
          '--no-sandbox',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });
      launched = true;
    }

    // Get or create a page
    const pages = await browser.pages();
    const page = pages.find(p => !p.isClosed()) || await browser.newPage();

    // Navigate to first URL to ensure cookies are loaded
    await page.goto(urls[0], { waitUntil: 'domcontentloaded' });

    // Use CDP Network.getAllCookies to get ALL cookies including httpOnly
    // page.cookies() only returns non-httpOnly cookies
    const client = await page.createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');
    await client.detach();

    // Filter by domain and names
    const filteredCookies = cookies.filter((cookie: any) =>
      urls.some(url => {
        const hostname = new URL(url).hostname;
        const domain = cookie.domain.replace(/^\./, '');
        return (
          cookie.domain === hostname ||
          cookie.domain === `.${hostname}` ||
          hostname.endsWith(domain)
        );
      })
    );

    const namedCookies = names && names.length > 0
      ? filteredCookies.filter((c: any) => names.includes(c.name))
      : filteredCookies;

    // Convert to our format
    const result: CDPCookie[] = namedCookies.map((cookie: any) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: typeof cookie.expires === 'number' ? cookie.expires : -1,
      httpOnly: cookie.httpOnly ?? false,
      secure: cookie.secure ?? false,
      sameSite: (cookie.sameSite as 'Strict' | 'Lax' | 'None') || 'None',
    }));

    return { cookies: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return {
        cookies: [],
        error: 'Cannot connect to Chrome. Enable remote debugging:\n1. Go to chrome://inspect/#remote-debugging\n2. Turn on "Remote debugging"',
      };
    }

    return {
      cookies: [],
      error: message,
    };
  } finally {
    if (browser) {
      if (launched) {
        await browser.close();
      } else {
        browser.disconnect();
      }
    }
  }
}

/**
 * Convert CDP cookies to a Cookie header string.
 */
export function toCookieHeader(cookies: CDPCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
