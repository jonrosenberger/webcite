const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MISSING: 'missing'
};

function getMeta(selector) {
  const node = document.querySelector(selector);
  return node ? (node.getAttribute('content') || '').trim() : '';
}

function getAttr(selector, attr) {
  const node = document.querySelector(selector);
  return node ? (node.getAttribute(attr) || '').trim() : '';
}

function textFrom(selector, root = document) {
  const node = root.querySelector(selector);
  return node ? cleanText(node.textContent || '') : '';
}

function firstNonEmpty(values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(value) {
  if (!value) return '';
  return cleanText(value).replace(/\s*[|–—-]\s*$/, '').trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanDateText(value) {
  return cleanText(value)
    .replace(/^(published|posted|updated|last updated|date)\s*:?\s*/i, '')
    .replace(/^by\s+[^,]+,?\s*/i, '')
    .trim();
}

function normalizeDate(value) {
  if (!value) return '';
  const cleaned = cleanDateText(value);
  const isoMatch = cleaned.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const compactMonthMatch = cleaned.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
  if (compactMonthMatch) {
    const date = new Date(`${compactMonthMatch[1]} ${compactMonthMatch[2]} ${compactMonthMatch[3]}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const longMonthMatch = cleaned.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (longMonthMatch) {
    const date = new Date(`${longMonthMatch[1]} ${longMonthMatch[2]}, ${longMonthMatch[3]}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeAuthor(author) {
  if (!author) return '';
  if (typeof author === 'string') return cleanText(author).replace(/^by\s+/i, '');
  if (Array.isArray(author)) return author.map(normalizeAuthor).filter(Boolean).join(', ');
  if (typeof author === 'object') return firstNonEmpty([
    author.name,
    author.givenName && author.familyName ? `${author.givenName} ${author.familyName}` : '',
    author.url
  ]);
  return '';
}

function domainName() {
  return document.location.hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripTrackingParams(url) {
  try {
    const parsed = new URL(url);
    const blockedPrefixes = ['utm_', 'syn-', 'syn_'];
    const blockedNames = ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', 'ref'];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (blockedNames.includes(key.toLowerCase()) || blockedPrefixes.some((prefix) => key.toLowerCase().startsWith(prefix))) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = '';
    return parsed.toString();
  } catch (_error) {
    return String(url || '').split('#')[0];
  }
}

function findJsonLdData() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const items = [];

  function collect(item) {
    if (!item) return;
    if (Array.isArray(item)) {
      item.forEach(collect);
      return;
    }
    if (item['@graph'] && Array.isArray(item['@graph'])) {
      item['@graph'].forEach(collect);
      return;
    }
    items.push(item);
  }

  for (const script of scripts) {
    try {
      collect(JSON.parse(script.textContent || ''));
    } catch (_error) {
      // Ignore malformed JSON-LD.
    }
  }

  const preferredTypes = ['NewsArticle', 'Article', 'BlogPosting', 'ScholarlyArticle', 'Report', 'WebPage'];
  return items.find((item) => {
    const type = item?.['@type'];
    const types = Array.isArray(type) ? type : [type];
    return types.some((entry) => preferredTypes.includes(entry));
  }) || items[0] || {};
}

function findOrganizationSchemaName() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || '');
      const items = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      const org = items.find((item) => {
        const type = item?.['@type'];
        const types = Array.isArray(type) ? type : [type];
        return types.includes('Organization') && item.name;
      });
      if (org?.name) return cleanText(org.name);
    } catch (_error) {
      // Ignore malformed JSON-LD.
    }
  }
  return '';
}

function articleRoot() {
  return document.querySelector('article') || document.querySelector('main') || document.body;
}

function nearestHeaderRoot() {
  return document.querySelector('article header') || document.querySelector('.post-header') || document.querySelector('.article-header') || document.querySelector('main header') || articleRoot();
}

function bylineText() {
  const root = nearestHeaderRoot();
  return firstNonEmpty([
    textFrom('[rel="author"]', root),
    textFrom('.author [class*="name"]', root),
    textFrom('.author__name', root),
    textFrom('.byline .author', root),
    textFrom('.byline', root),
    textFrom('[class*="byline"]', root)
  ]).replace(/^by\s+/i, '');
}

function visibleArticleDate() {
  const root = nearestHeaderRoot();
  const datetime = firstNonEmpty([
    getAttr('article header time[datetime]', 'datetime'),
    getAttr('main header time[datetime]', 'datetime'),
    getAttr('article time[datetime]', 'datetime'),
    getAttr('main time[datetime]', 'datetime')
  ]);

  const visible = firstNonEmpty([
    datetime,
    textFrom('.author__date', root),
    textFrom('.article__date', root),
    textFrom('.post-date', root),
    textFrom('.published', root),
    textFrom('.entry-date', root),
    textFrom('[class*="date"]', root)
  ]);

  return normalizeDate(visible);
}

function visibleUpdatedDate() {
  const root = articleRoot();
  const candidates = Array.from(root.querySelectorAll('time, [class*="updated"], [class*="modified"]'))
    .map((node) => node.getAttribute('datetime') || node.textContent || '')
    .filter((value) => /updated|modified|last updated/i.test(value) || nodeLooksUpdated(value));

  return normalizeDate(firstNonEmpty(candidates));
}

function nodeLooksUpdated(value) {
  return /updated|modified/i.test(String(value || ''));
}

function field(value, confidence, source) {
  const normalized = cleanText(value);
  return {
    value: normalized,
    confidence: normalized ? confidence : CONFIDENCE.MISSING,
    source: normalized ? source : 'Not found'
  };
}

function dateField(value, confidence, source) {
  const normalized = normalizeDate(value);
  return {
    value: normalized,
    confidence: normalized ? confidence : CONFIDENCE.MISSING,
    source: normalized ? source : 'Not found'
  };
}

function choose(candidates) {
  for (const candidate of candidates) {
    const value = candidate.normalizeDate ? normalizeDate(candidate.value) : cleanText(candidate.value);
    if (value) return { value, confidence: candidate.confidence, source: candidate.source };
  }
  return { value: '', confidence: CONFIDENCE.MISSING, source: 'Not found' };
}

function extractCitationData() {
  const jsonLd = findJsonLdData();
  const publisher = typeof jsonLd.publisher === 'object' ? jsonLd.publisher?.name : jsonLd.publisher;
  const orgSchema = findOrganizationSchemaName();
  const canonicalUrl = stripTrackingParams(getAttr('link[rel="canonical"]', 'href'));
  const ogUrl = stripTrackingParams(getMeta('meta[property="og:url"]'));
  const rawUrl = stripTrackingParams(window.location.href);

  const siteNameField = choose([
    { value: publisher, confidence: CONFIDENCE.HIGH, source: 'JSON-LD publisher' },
    { value: getMeta('meta[property="og:site_name"]'), confidence: CONFIDENCE.HIGH, source: 'Open Graph site name' },
    { value: getMeta('meta[name="application-name"]'), confidence: CONFIDENCE.MEDIUM, source: 'Application name meta tag' },
    { value: orgSchema, confidence: CONFIDENCE.MEDIUM, source: 'Organization structured data' },
    { value: domainName(), confidence: CONFIDENCE.LOW, source: 'Cleaned domain name' }
  ]);

  const rawTitleField = choose([
    { value: jsonLd.headline, confidence: CONFIDENCE.HIGH, source: 'JSON-LD headline' },
    { value: jsonLd.name, confidence: CONFIDENCE.HIGH, source: 'JSON-LD name' },
    { value: getMeta('meta[property="og:title"]'), confidence: CONFIDENCE.HIGH, source: 'Open Graph title' },
    { value: getMeta('meta[name="twitter:title"]'), confidence: CONFIDENCE.MEDIUM, source: 'Twitter title' },
    { value: textFrom('article h1') || textFrom('main h1') || textFrom('h1'), confidence: CONFIDENCE.MEDIUM, source: 'Visible page heading' },
    { value: document.title, confidence: CONFIDENCE.LOW, source: 'Browser title' }
  ]);

  let pageTitle = rawTitleField.value;
  if (pageTitle && siteNameField.value) {
    pageTitle = cleanTitle(pageTitle.replace(new RegExp(`\\s*[|–—-]\\s*${escapeRegExp(siteNameField.value)}\\s*$`, 'i'), ''));
  }

  const data = {
    author: choose([
      { value: normalizeAuthor(jsonLd.author), confidence: CONFIDENCE.HIGH, source: 'JSON-LD author' },
      { value: getMeta('meta[name="author"]'), confidence: CONFIDENCE.HIGH, source: 'Author meta tag' },
      { value: getMeta('meta[property="article:author"]'), confidence: CONFIDENCE.HIGH, source: 'Article author meta tag' },
      { value: getMeta('meta[name="citation_author"]'), confidence: CONFIDENCE.HIGH, source: 'Citation author meta tag' },
      { value: bylineText(), confidence: CONFIDENCE.MEDIUM, source: 'Visible article byline' }
    ]),
    pageTitle: { value: pageTitle, confidence: rawTitleField.confidence, source: rawTitleField.source },
    websiteTitle: siteNameField,
    publisher: choose([
      { value: publisher, confidence: CONFIDENCE.HIGH, source: 'JSON-LD publisher' },
      { value: getMeta('meta[name="publisher"]'), confidence: CONFIDENCE.HIGH, source: 'Publisher meta tag' },
      { value: getMeta('meta[name="citation_publisher"]'), confidence: CONFIDENCE.HIGH, source: 'Citation publisher meta tag' },
      { value: orgSchema, confidence: CONFIDENCE.MEDIUM, source: 'Organization structured data' },
      { value: siteNameField.value, confidence: CONFIDENCE.LOW, source: 'Website title fallback' }
    ]),
    publishedDate: choose([
      { value: jsonLd.datePublished, confidence: CONFIDENCE.HIGH, source: 'JSON-LD datePublished', normalizeDate: true },
      { value: getMeta('meta[property="article:published_time"]'), confidence: CONFIDENCE.HIGH, source: 'Article published meta tag', normalizeDate: true },
      { value: getMeta('meta[name="citation_publication_date"]'), confidence: CONFIDENCE.HIGH, source: 'Citation publication date meta tag', normalizeDate: true },
      { value: getMeta('meta[name="dc.date"]') || getMeta('meta[name="date"]') || getMeta('meta[name="pubdate"]'), confidence: CONFIDENCE.MEDIUM, source: 'Date meta tag', normalizeDate: true },
      { value: visibleArticleDate(), confidence: CONFIDENCE.MEDIUM, source: 'Visible article/header date', normalizeDate: true }
    ]),
    updatedDate: choose([
      { value: jsonLd.dateModified, confidence: CONFIDENCE.HIGH, source: 'JSON-LD dateModified', normalizeDate: true },
      { value: getMeta('meta[property="article:modified_time"]'), confidence: CONFIDENCE.HIGH, source: 'Article modified meta tag', normalizeDate: true },
      { value: getMeta('meta[name="lastmod"]'), confidence: CONFIDENCE.MEDIUM, source: 'Last modified meta tag', normalizeDate: true },
      { value: visibleUpdatedDate(), confidence: CONFIDENCE.LOW, source: 'Visible updated/modified label', normalizeDate: true }
    ]),
    accessedDate: { value: new Date().toISOString().slice(0, 10), confidence: CONFIDENCE.HIGH, source: 'Generated today' },
    url: choose([
      { value: canonicalUrl, confidence: CONFIDENCE.HIGH, source: 'Canonical URL' },
      { value: ogUrl, confidence: CONFIDENCE.HIGH, source: 'Open Graph URL' },
      { value: rawUrl, confidence: CONFIDENCE.MEDIUM, source: 'Current tab URL, cleaned' }
    ])
  };

  return data;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'WEBCITE_EXTRACT') return false;
  sendResponse({ ok: true, data: extractCitationData() });
  return true;
});
