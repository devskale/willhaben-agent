import { getCookies, toCookieHeader } from "@steipete/sweet-cookie";

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

export const checkAuth = async (): Promise<AuthState> => {
  try {
    const { cookies } = await getCookies({
      url: "https://www.willhaben.at",
      browsers: ["chrome", "edge", "firefox", "safari"],
    });

    if (cookies.length === 0) {
      return { isAuthenticated: false, cookies: "" };
    }

    const cookieHeader = toCookieHeader(cookies);

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
        } catch (e) {
          // ignore parsing error
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
