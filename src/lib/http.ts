/**
 * Shared HTTP header builders for willhaben API calls.
 *
 * Three patterns:
 * 1. JSON API (public)  — visitor cookies, CSRF, WH_CLIENT
 * 2. HTML scrape (auth) — session cookies, HTML Accept
 * 3. WebAPI (auth)      — session + visitor cookies, CSRF, userId
 *
 * Usage:
 *   const { headers } = await getPublicHeaders();
 *   const { headers } = await getHtmlHeaders();
 *   const { headers, userId } = await getAuthHeaders();
 */

import { checkAuth, getVisitorCookies } from '../agents/auth.js';
import { WH_CLIENT, UA, BASE_URL } from './constants.js';

/**
 * Public JSON API headers — search, similar, vehicles.
 * No login required.
 */
export async function getPublicHeaders(): Promise<{ headers: Record<string, string> }> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();
  return {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'x-bbx-csrf-token': csrfToken,
      'x-wh-client': WH_CLIENT,
      Referer: `${BASE_URL}/`,
      Cookie: cookieHeader,
    },
  };
}

/**
 * Authenticated HTML headers — detail pages, seller, merkliste HTML.
 * Uses session cookies from checkAuth().
 */
export async function getHtmlHeaders(): Promise<{ headers: Record<string, string>; cookies: string }> {
  const { cookies } = await checkAuth();
  return {
    cookies,
    headers: {
      'User-Agent': UA,
      Cookie: cookies,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
    },
  };
}

/**
 * Authenticated JSON API headers — folder operations, write operations.
 * Combines session + visitor cookies, extracts CSRF and numeric userId.
 */
export async function getAuthHeaders(): Promise<{ headers: Record<string, string>; userId: string }> {
  const { cookies, user } = await checkAuth();
  if (!user?.id) throw new Error('Not authenticated — no user ID found');

  const { csrfToken, cookieHeader: visitorCookies } = await getVisitorCookies();
  const allCookies = [cookies, visitorCookies].filter(Boolean).join('; ');

  // Extract CSRF from session cookies (prefer session token over visitor)
  const cookieMap = Object.fromEntries(
    cookies.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }),
  );
  const csrf = cookieMap['x-bbx-csrf-token'] || csrfToken;

  // Extract numeric userId from BBX_JSESSIONID cookie (format: "20759581__<uuid>")
  const sessionCookie = cookieMap['BBX_JSESSIONID'] || '';
  const numericUserId = sessionCookie.split('__')[0] || user.id;

  return {
    userId: numericUserId,
    headers: {
      Accept: 'application/json',
      Cookie: allCookies,
      'x-bbx-csrf-token': csrf,
      'x-wh-client': WH_CLIENT,
      'Cache-Control': 'no-cache',
      'User-Agent': UA,
      Referer: `${BASE_URL}/`,
      Origin: BASE_URL,
    },
  };
}
