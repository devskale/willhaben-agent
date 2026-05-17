import { getHtmlHeaders } from './src/lib/http.js';
import { BASE_URL } from './src/lib/constants.js';
import { load } from 'cheerio';

async function main() {
  const { headers } = await getHtmlHeaders();
  const resp = await fetch(`${BASE_URL}/iad/object?adId=1686201828`, { headers });
  const html = await resp.text();
  
  // Search for BUILDING_TYPE anywhere in the HTML
  const idx = html.indexOf('BUILDING_TYPE');
  if (idx >= 0) {
    console.log('Found in HTML at:', idx);
    console.log(html.substring(idx-100, idx+200));
  } else {
    console.log('NOT in HTML at all');
  }
  
  // Check for other JSON script tags
  const $ = load(html);
  const scripts = $('script:not[src]');
  console.log(`\nInline scripts: ${scripts.length}`);
  scripts.each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('BUILDING_TYPE') || text.includes('Altbau')) {
      console.log(`Script ${i}: has ${text.includes('BUILDING_TYPE') ? 'BUILDING_TYPE' : 'Altbau'}`);
    }
  });
}
main();
