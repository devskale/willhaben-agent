import { getCookies, toCookieHeader } from "@steipete/sweet-cookie";

export interface AuthState {
  isAuthenticated: boolean;
  cookies: string;
  error?: string;
}

export const checkAuth = async (): Promise<AuthState> => {
  try {
    const { cookies } = await getCookies({
      url: "https://willhaben.at",
      browsers: ["chrome", "edge", "firefox", "safari"],
    });

    if (cookies.length === 0) {
      return { isAuthenticated: false, cookies: "" };
    }

    const cookieHeader = toCookieHeader(cookies);
    // TODO: Validate cookies by making a request to willhaben.at/api/profile/v1/self

    return { isAuthenticated: true, cookies: cookieHeader };
  } catch (error) {
    return {
      isAuthenticated: false,
      cookies: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
