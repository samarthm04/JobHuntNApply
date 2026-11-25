// /hunter career-site reader: big tech, MBB and Big 4 sites that have no Greenhouse/Lever/Ashby board.
// Reads only public search pages (no login), a few pages per keyword per site, and prints JSON to stdout.
// Usage: node careers.js [site ...]   (no args = all sites)
// Not covered: Meta (job search needs a login), McKinsey (site refuses automated requests).

const { chromium } = require('playwright');

const KEYWORDS = ['machine learning', 'generative AI', 'AI engineer', 'data scientist', 'computer vision'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const q = encodeURIComponent;
const isIndia = s => /india|\bIN\b|mumbai|pune|hyderabad|bengaluru|bangalore|gurugram|gurgaon|noida|delhi|chennai|kolkata|kochi|trivandrum|ahmedabad/i.test(s || '');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const { execFileSync } = require('child_process');
// JSON feeds are fetched with curl (it follows the system proxy and certificates everywhere).
// Polite pacing: one request at a time, a pause before each, one slower retry on "too many requests".
async function getJSON(url, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    await sleep(attempt ? 30000 : (opts.pause || 1500));
    const args = ['-sS', '-m', '30', '-A', UA, '-H', 'Content-Type: application/json', '-w', '\n%{http_code}'];
    if (opts.body) args.push('--data-raw', opts.body);
    const out = execFileSync('curl', [...args, url], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const i = out.lastIndexOf('\n'), status = +out.slice(i + 1), body = out.slice(0, i);
    if (status === 429 && attempt < 1) continue;
    if (status !== 200) throw new Error(`HTTP ${status}`);
    return JSON.parse(body);
  }
}

// Sites with a public JSON feed.
const API = {
  async amazon(kw) {
    const d = await getJSON(`https://www.amazon.jobs/en/search.json?base_query=${q(kw)}&normalized_country_code%5B%5D=IND&result_limit=100&sort=recent`);
    return d.jobs.map(j => ({ title: j.title, location: j.normalized_location, posted: j.posted_date, url: 'https://www.amazon.jobs' + j.job_path }));
  },
  async microsoft(kw) {
    const out = [];
    for (let start = 0; start < 20; start += 10) {
      let d; try { d = await getJSON(`https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=${q(kw)}&location=India&start=${start}`, { pause: 12000 }); } catch (e) { if (out.length) break; throw e; }
      const p = d.data.positions || [];
      out.push(...p.map(j => ({ title: j.name, location: j.standardizedLocations.join('; '), mode: j.workLocationOption,
        posted: new Date(j.postedTs * 1000).toISOString().slice(0, 10), url: 'https://apply.careers.microsoft.com' + j.positionUrl })));
      if (p.length < 10) break;
    }
    return out;
  },
  async pwc(kw) {
    const d = await getJSON('https://pwc.wd3.myworkdayjobs.com/wday/cxs/pwc/Global_Experienced_Careers/jobs',
      { method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: `${kw} India` }) });
    return d.jobPostings.filter(j => isIndia(j.locationsText + ' ' + j.externalPath)).map(j => ({ title: j.title, location: j.locationsText, posted: j.postedOn,
      url: 'https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers' + j.externalPath }));
  },
};

// Sites read in a real browser.
async function linksOnPage(page, url, link) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const rows = await page.$$eval('a[href]', as => as.map(a => {
    const row = a.closest('li, tr, article, [role=listitem]') || a.parentElement;
    const head = row && row.querySelector('h2, h3, h4');
    return { href: a.href, title: (a.innerText.trim() || (head ? head.innerText.trim() : '')),
      context: (row ? row.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300) };
  }));
  return rows.filter(r => link.test(r.href) && !/locationPicker/.test(r.href) && r.title.length > 3 && r.title.length < 200
      && !/^(apply|share|save|view|learn more|where we)/i.test(r.title))
    .map(r => ({ title: r.title.split('\n')[0], location: r.context, url: r.href.split('?')[0] }));
}

const PAGE = {
  google: (page, kw) => linksOnPage(page, `https://www.google.com/about/careers/applications/jobs/results?q=${q(kw)}&location=India&target_level=EARLY`, /jobs\/results\/\d+-/),
  apple: (page, kw) => linksOnPage(page, `https://jobs.apple.com/en-in/search?search=${q(kw)}&location=india-INDC`, /\/details\/\d+/),
  ey: (page, kw) => linksOnPage(page, `https://careers.ey.com/ey/search/?q=${q(kw)}&locationsearch=India`, /\/ey\/job\//),
  deloitte_india: (page, kw) => linksOnPage(page, `https://southasiacareers.deloitte.com/search/?q=${q(kw)}`, /\/job\//),
  deloitte_usi: (page, kw) => linksOnPage(page, `https://usijobs.deloitte.com/en_US/careersUSI/SearchJobs/${q(kw)}`, /JobDetail\//),
  async bcg(page, kw) {
    // BCG India has few roles, so search it broadly; the scorers do the narrowing.
    if (kw !== KEYWORDS[0]) return [];
    const out = [];
    for (kw of ['data', 'AI', 'analytics', 'engineer', 'technology']) {
      // One page per keyword: BCG drops the country filter on paged URLs.
      await page.goto(`https://careers.bcg.com/global/en/search-results?keywords=${q(kw)}&qcountry=India`, { waitUntil: 'networkidle', timeout: 45000 });
      const jobs = await page.evaluate(() => (window.phApp && phApp.ddo.eagerLoadRefineSearch && phApp.ddo.eagerLoadRefineSearch.data.jobs) || []);
      out.push(...jobs.filter(j => isIndia(JSON.stringify(j.multi_location || j.location) + ' ' + j.country)).map(j => ({
        title: j.title, location: (j.multi_location || [j.location]).join('; '), posted: (j.postedDate || '').slice(0, 10),
        url: `https://careers.bcg.com/global/en/job/${j.jobSeqNo}` })));
    }
    return out;
  },
  async bain(page) {
    // The page loads its own job feed; read the response it receives (Mumbai = 275, New Delhi = 276).
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('jobsearch/keyword/get'), { timeout: 45000 }),
      page.goto('https://www.bain.com/careers/find-a-role/?filters=offices(275)|offices(276)'),
    ]);
    const d = await resp.json();
    return (d.results || []).map(j => ({ title: j.JobTitle, location: 'Mumbai / New Delhi (and other offices)',
      url: `https://www.bain.com/careers/find-a-role/position/?jobid=${j.JobId}` }));
  },
};
const ONCE = new Set(['bain']);

(async () => {
  const want = process.argv.slice(2);
  const pick = name => !want.length || want.includes(name);
  const results = {}, errors = {};
  for (const [name, fn] of Object.entries(API)) {
    if (!pick(name)) continue;
    results[name] = [];
    for (const kw of KEYWORDS) {
      try { results[name].push(...await fn(kw)); }
      catch (e) { errors[name] = `${e.message} (on "${kw}"; kept the rest)`; }
    }
  }
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(PAGE)) {
    if (!pick(name)) continue;
    const page = await browser.newPage({ userAgent: UA });
    try { results[name] = []; for (const kw of (ONCE.has(name) ? [''] : KEYWORDS)) results[name].push(...await fn(page, kw)); }
    catch (e) { errors[name] = e.message.split('\n')[0]; }
    finally { await page.close(); }
  }
  await browser.close();
  const jobs = [];
  for (const [company, list] of Object.entries(results)) {
    const seen = new Set();
    for (const j of list) if (!seen.has(j.url)) { seen.add(j.url); jobs.push({ company, ...j }); }
  }
  process.stdout.write(JSON.stringify({ fetched: new Date().toISOString(), errors, jobs }, null, 1));
})();
