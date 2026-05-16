/**
 * Shared constants for whcli.
 *
 * Single source of truth for User-Agent, API headers, and base URLs.
 * Import from here — don't duplicate.
 */

export const WH_CLIENT = 'api@willhaben.at;responsive_web;server;1.0.0;desktop';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const BASE_URL = 'https://www.willhaben.at';

export const MERKLISTE_URL = `${BASE_URL}/iad/myprofile/myfindings`;

export const ITEMS_PER_PAGE = 50;
