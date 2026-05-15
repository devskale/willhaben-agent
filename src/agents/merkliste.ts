/**
 * Merkliste (Favorites) downloader for whcli.
 *
 * Fetches the merkliste pages from willhaben.at using existing sweet-cookie auth,
 * parses the SSR HTML, and outputs as CSV or JSON.
 */

import { checkAuth, getVisitorCookies } from './auth.js';

const MERKLISTE_URL = 'https://www.willhaben.at/iad/myprofile/myfindings';
const ITEMS_PER_PAGE = 50;

export interface MerklisteItem {
  id: string;
  title: string;
  price: string;
  description: string;
  url: string;
  imageUrl: string;
  location: string;
  dateAdded: string;
}

/**
 * Fetch a single page of the merkliste and parse items from HTML.
 */
async function fetchMerklistePage(
  page: number,
  headers: Record<string, string>,
): Promise<{ items: MerklisteItem[]; totalCount: number }> {
  const url = page <= 1 ? MERKLISTE_URL : `${MERKLISTE_URL}?page=${page}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch merkliste page ${page}: ${response.status}`);
  }

  const html = await response.text();

  // Extract total count from __NEXT_DATA__
  const totalCount = parseInt(
    html.match(/"advertCount":(\d+)/)?.[1] || '0',
    10,
  );

  // Split HTML by item wrapper markers
  const segments = html.split('savedadsitemrow-wrapper-');
  segments.shift(); // remove preamble

  const items: MerklisteItem[] = [];

  for (const seg of segments) {
    const idMatch = seg.match(/^(\d+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Title from h3
    const titleMatch = seg.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
      : '';

    // Price
    const priceMatch = seg.match(/€\s*([\d.,]+)/);
    const price = priceMatch ? priceMatch[1] : '';

    // Image
    const imgMatch = seg.match(/src="(https:\/\/cache\.willhaben\.at\/mmo\/[^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : '';

    // Description - in a <div> after the price div (class contains 'htvXtX')
    const descDivMatch = seg.match(
      /class="Box-sc[^"]*htvXtX[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    let description = descDivMatch
      ? descDivMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
      : '';

    // Fallback: extract text between price and date
    if (!description) {
      const plain = seg
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ');
      const descM = plain.match(
        /€\s*[\d.,]+\s+([\s\S]{10,400}?)(?:\d{2}\.\d{2}\.|$)/,
      );
      description = descM ? descM[1].trim() : '';
    }

    // Date (e.g. "18.04. - 08:21 Uhr" or "03.05.2026 - 08:52 Uhr")
    const dateMatch = seg.match(
      /(\d{2}\.\d{2}\.(?:\d{4})?\s*-?\s*\d{2}:\d{2})\s*Uhr/,
    );
    const dateAdded = dateMatch ? dateMatch[1] : '';

    // Location - from cqeyDH class (e.g. "2333 Leopoldsdorf")
    const locMatch = seg.match(
      /class="Text-sc[^"]*cqeyDH[^"]*"[^>]*>([\s\S]*?)<\/p>/,
    );
    const location = locMatch
      ? locMatch[1].replace(/<[^>]*>/g, '').trim()
      : '';

    items.push({
      id,
      title,
      price,
      description: description.substring(0, 500),
      url: `https://www.willhaben.at/iad/object?adId=${id}`,
      imageUrl,
      location,
      dateAdded,
    });
  }

  return { items, totalCount };
}

/**
 * Download all merkliste items (paginates automatically).
 */
export async function downloadMerkliste(): Promise<MerklisteItem[]> {
  const { cookies } = await checkAuth();
  const { csrfToken, cookieHeader: visitorCookies } =
    await getVisitorCookies();
  const allCookies = [cookies, visitorCookies].filter(Boolean).join('; ');

  const headers: Record<string, string> = {
    Cookie: allCookies,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Accept: 'text/html',
    'X-CSRF-Token': csrfToken,
  };

  // Fetch page 1 to get total count
  const { items, totalCount } = await fetchMerklistePage(1, headers);

  // Calculate remaining pages
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page++) {
      const result = await fetchMerklistePage(page, headers);
      items.push(...result.items);
    }
  }

  return items;
}

/**
 * Convert merkliste items to CSV string.
 */
export function itemsToCSV(items: MerklisteItem[]): string {
  const header =
    '#,Beschreibung,Preis,Beschreibung Detail,URL,willhaben ID,Ort,Datum,Bild';
  const rows = items.map((item, i) => {
    const title = item.title.replace(/"/g, '""');
    const desc = item.description.replace(/"/g, '""');
    const loc = item.location.replace(/"/g, '""');
    return [
      i + 1,
      `"${title}"`,
      `"€${item.price}"`,
      `"${desc}"`,
      item.url,
      item.id,
      `"${loc}"`,
      `"${item.dateAdded}"`,
      item.imageUrl,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
