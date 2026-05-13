import { getCookies, toCookieHeader } from "@steipete/sweet-cookie";
import { getCookiesViaCDP, toCookieHeader as toCDPCookieHeader } from "../lib/cdpCookies.js";

export interface VisitorCookies {
  csrfToken: string;
  cookieHeader: string;
}

/**
 * Get anonymous visitor cookies from willhaben.at.
 * No login required — just a GET request to the homepage.
 * Returns CSRF token + cookie header for JSON API calls.
 */
export const getVisitorCookies = async (): Promise<VisitorCookies> => {
  const resp = await fetch("https://www.willhaben.at/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  const setCookies = resp.headers.getSetCookie();
  const cookies: string[] = [];
  let csrfToken = "";

  for (const sc of setCookies) {
    const parts = sc.split(";")[0]; // "name=value"
    cookies.push(parts);
    if (parts.startsWith("x-bbx-csrf-token=")) {
      csrfToken = parts.split("=")[1];
    }
  }

  if (!csrfToken) {
    throw new Error("Failed to obtain CSRF token from visitor cookies");
  }

  return {
    csrfToken,
    cookieHeader: cookies.join("; "),
  };
};

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

export interface AuthState {
  isAuthenticated: boolean;
  cookies: string;
  error?: string;
  user?: {
    name: string;
    email?: string;
    id?: string;
    postCode?: string;
    memberSince?: string;
  };
}

export const checkAuth = async (useCDP = false): Promise<AuthState> => {
  try {
    // Chrome profile path - cross-platform
    const localAppData = process.env.LOCALAPPDATA || '';
    const chromeProfile = process.env.CHROME_PROFILE || 'Default';
    const chromeProfilePath = isMac
      ? `${process.env.HOME}/Library/Application Support/Google/Chrome/${chromeProfile}`
      : isWin
        ? `${localAppData}\\Google\\Chrome\\User Data\\${chromeProfile}`
        : `${process.env.HOME}/.config/google-chrome/${chromeProfile}`;

    let cookieHeader: string;

    if (useCDP) {
      // Use CDP (Chrome DevTools Protocol) - bypasses v20 encryption
      // IMPORTANT: Chrome Beta must be closed!
      const result = await getCookiesViaCDP({
        urls: ["https://www.willhaben.at"],
      });

      if (result.error) {
        return {
          isAuthenticated: false,
          cookies: "",
          error: result.error,
        };
      }

      if (result.cookies.length === 0) {
        return { isAuthenticated: false, cookies: "" };
      }

      cookieHeader = toCDPCookieHeader(result.cookies);
    } else {
      // Use sweet-cookie (may fail with v20 cookies)
      const { cookies, warnings } = await getCookies({
        url: "https://www.willhaben.at",
        browsers: ["chrome"],
        chromeProfile: chromeProfilePath,
      });

      if (cookies.length === 0) {
        // Check if v20 warning was issued
        const v20Warning = warnings.find(w => w.includes('v20'));
        if (v20Warning) {
          return {
            isAuthenticated: false,
            cookies: "",
            error: "Chrome v20 cookies detected. Use --cdp flag or close Chrome Beta and try again.",
          };
        }
        return { isAuthenticated: false, cookies: "" };
      }

      cookieHeader = toCookieHeader(cookies);
    }

    // Validate cookies by fetching the home page and checking for user data
    const response = await fetch("https://www.willhaben.at/", {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return {
        isAuthenticated: false,
        cookies: cookieHeader,
        error: `Validation failed: ${response.status}`,
      };
    }

    const html = await response.text();
    const nextDataMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/
    );

    if (nextDataMatch) {
      const data = JSON.parse(nextDataMatch[1]);

      // Check for profileData in pageProps (new structure found)
      const profileData = data?.props?.pageProps?.profileData;

      if (profileData) {
        return {
          isAuthenticated: true,
          cookies: cookieHeader,
          user: {
            name:
              `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() ||
              profileData.displayName ||
              "User",
            email: profileData.emailAddress,
            id: profileData.uuid || profileData.loginId,
            memberSince: profileData.created,
            postCode: profileData.addressPostcode,
          },
        };
      }

      const jsonStr = JSON.stringify(data);

      // Check for authenticated user data
      // This pattern is based on observation that logged-in state usually has user object
      const userMatches = jsonStr.match(/"user":({.*?})/);

      if (userMatches) {
        try {
          const userObj = JSON.parse(userMatches[1]);
          // Simple heuristic: if we have a user object with an ID, we are likely logged in
          if (userObj.id || userObj.displayName) {
            return {
              isAuthenticated: true,
              cookies: cookieHeader,
              user: {
                name: userObj.displayName || "User",
                email: userObj.email,
              },
            };
          }
        } catch {
          // Ignore parsing error
        }
      }
    }

    // Fallback: If we have WH_AUTO cookie, we might be logged in but failed to parse HTML.
    // However, safest is to assume NOT authenticated if we can't confirm it.
    // But since the user complained about 404 on API, strict validation is better.

    // For now, if we didn't find the user object, we assume not authenticated.
    return {
      isAuthenticated: false,
      cookies: cookieHeader,
      error: "Session invalid or expired",
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      cookies: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
