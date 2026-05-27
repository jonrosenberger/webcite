const FIELD_IDS = ['author', 'pageTitle', 'websiteTitle', 'publisher', 'publishedDate', 'updatedDate', 'accessedDate', 'url'];
const FORMAT_STORAGE_KEY = 'webcite:selectedFormat';
const DEFAULT_FORMAT = 'mla';

const state = {
  format: DEFAULT_FORMAT,
  trust: {}
};

const statusBox = document.getElementById('statusBox');
const citationOutput = document.getElementById('citationOutput');
const citationPreview = document.getElementById('citationPreview');
const copyStatus = document.getElementById('copyStatus');
const copyButton = document.getElementById('copyButton');
const refreshButton = document.getElementById('refreshButton');
const formatButtons = Array.from(document.querySelectorAll('.format-button'));

function getFieldValues() {
  return FIELD_IDS.reduce((values, id) => {
    values[id] = document.getElementById(id).value.trim();
    return values;
  }, {});
}

function normalizeExtractedField(field) {
  if (field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    return {
      value: field.value || '',
      confidence: field.confidence || (field.value ? 'low' : 'missing'),
      source: field.source || (field.value ? 'Unknown source' : 'Not found')
    };
  }

  return {
    value: field || '',
    confidence: field ? 'low' : 'missing',
    source: field ? 'Legacy extraction' : 'Not found'
  };
}

function trustLabel(confidence) {
  switch (confidence) {
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return 'Missing';
  }
}

function updateTrustBadge(id, confidence = 'missing', source = 'Not found') {
  const badge = document.getElementById(`${id}Trust`);
  const sourceNode = document.getElementById(`${id}Source`);
  if (!badge || !sourceNode) return;

  badge.className = `trust-badge ${confidence}`;
  badge.textContent = trustLabel(confidence);
  sourceNode.textContent = source;
}

function setFieldValues(data) {
  for (const id of FIELD_IDS) {
    const normalized = normalizeExtractedField(data?.[id]);
    document.getElementById(id).value = normalized.value;
    state.trust[id] = { confidence: normalized.confidence, source: normalized.source };
    updateTrustBadge(id, normalized.confidence, normalized.source);
  }
  updateCitation();
}

function markEditedField(id) {
  const value = document.getElementById(id).value.trim();
  const confidence = value ? 'manual' : 'missing';
  const badge = document.getElementById(`${id}Trust`);
  const sourceNode = document.getElementById(`${id}Source`);
  if (!badge || !sourceNode) return;

  badge.className = value ? 'trust-badge manual' : 'trust-badge missing';
  badge.textContent = value ? 'Edited' : 'Missing';
  sourceNode.textContent = value ? 'Manually edited' : 'Not found';
}

function stripTrailingSlash(url) {
  return (url || '').replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatHumanDate(value, style = 'mla') {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  if (style === 'apa') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (style === 'mla') {
    const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toApaDate(value) {
  if (!value) return 'n.d.';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function period(value) {
  if (!value) return '';
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function quoted(value) {
  if (!value) return '';
  return /[!?.]$/.test(value) ? `“${value}”` : `“${value}.”`;
}

// HTML-safe equivalent of quoted() — escapes the title before wrapping in quotes.
// Handles existing terminal punctuation the same way quoted() does.
function quotedHtml(value) {
  if (!value) return '';
  const escaped = escapeHtml(value);
  return /[!?.]$/.test(value) ? `"${escaped}"` : `"${escaped}."`;
}

// Author name formatting helpers.
// Metadata sources return names in natural order ("Jane Smith").
// MLA 9 and Chicago bib want "Smith, Jane"; APA 7 wants "Smith, J."
// We attempt inversion only when the value looks like "First Last" (two tokens,
// no comma already present, not all-caps abbreviation like "WHO", and no
// org-indicator word anywhere in the name).
const ORG_INDICATORS = new Set([
  'organization', 'organisation', 'association', 'institute', 'institution',
  'university', 'college', 'department', 'ministry', 'agency', 'service',
  'company', 'corporation', 'inc', 'llc', 'ltd', 'foundation', 'museum',
  'library', 'archives', 'archive', 'press', 'bureau', 'committee',
  'commission', 'council', 'authority', 'office', 'center', 'centre',
  'network', 'group', 'alliance', 'coalition', 'federation', 'society',
  'academy', 'school', 'program', 'programme', 'project', 'initiative',
  'control', 'prevention', 'health', 'national', 'international', 'global',
  'american', 'european', 'federal', 'state', 'public', 'general'
]);

function looksLikeNaturalName(value) {
  if (!value) return false;
  if (value.includes(',')) return false;         // already inverted
  const tokens = value.trim().split(/\s+/);
  if (tokens.length < 2) return false;           // single token — org or mononym
  if (tokens.every((t) => t === t.toUpperCase() && t.length > 1)) return false; // all-caps acronym org
  // If any token (stripped of punctuation) matches an org-indicator word, don't invert.
  if (tokens.some((t) => ORG_INDICATORS.has(t.replace(/[^a-z]/gi, '').toLowerCase()))) return false;
  // Don't invert names with 4+ tokens — personal names rarely exceed "First Middle Last"
  // and longer strings are almost certainly org names or brands.
  if (tokens.length > 3) return false;
  return true;
}

function toLastFirst(value) {
  if (!looksLikeNaturalName(value)) return value;
  const tokens = value.trim().split(/\s+/);
  const last = tokens[tokens.length - 1];
  const rest = tokens.slice(0, -1).join(' ');
  return `${last}, ${rest}`;
}

function toLastInitials(value) {
  if (!looksLikeNaturalName(value)) return value;
  const tokens = value.trim().split(/\s+/);
  const last = tokens[tokens.length - 1];
  const initials = tokens.slice(0, -1).map((t) => `${t[0].toUpperCase()}.`).join(' ');
  return `${last}, ${initials}`;
}

function joinLines(lines) {
  return lines.filter(Boolean).map((line) => line.trim()).join('\n');
}

function htmlLines(lines) {
  return lines.filter(Boolean).map((line) => `<span>${line}</span>`).join('<br>');
}

function renderItalic(value) {
  return value ? `<em>${escapeHtml(value)}</em>` : '';
}

function textCitationFromLines(lines) {
  return joinLines(lines.map((line) => line.text));
}

function htmlCitationFromLines(lines) {
  return htmlLines(lines.map((line) => line.html || escapeHtml(line.text)));
}

function buildMla(fields) {
  const author = fields.author ? toLastFirst(fields.author) : '';
  const url = fields.url ? period(stripTrailingSlash(fields.url)) : '';
  const title = fields.pageTitle ? quoted(fields.pageTitle) : '';
  const website = fields.websiteTitle ? `${fields.websiteTitle},` : '';
  const publisher = fields.publisher && fields.publisher !== fields.websiteTitle ? period(fields.publisher) : '';
  const published = fields.publishedDate ? `${formatHumanDate(fields.publishedDate)},` : '';
  const accessed = fields.accessedDate ? `Accessed ${formatHumanDate(fields.accessedDate)}.` : '';

  const firstLine = [author ? period(author) : '', title].filter(Boolean).join(' ');
  const secondLineText = [website, publisher, published, url].filter(Boolean).join(' ').replace(/,\s+https?:/i, ', https:');

  // Build HTML title safely: escape the page title first, then wrap in quotes.
  const titleHtml = fields.pageTitle ? quotedHtml(fields.pageTitle) : '';
  const secondLineHtml = [
    fields.websiteTitle ? `${renderItalic(fields.websiteTitle)},` : '',
    publisher ? escapeHtml(publisher) : '',
    published ? escapeHtml(published) : '',
    url ? escapeHtml(url) : ''
  ].filter(Boolean).join(' ');

  return {
    text: textCitationFromLines([
      { text: firstLine },
      { text: secondLineText },
      { text: accessed }
    ]),
    html: htmlCitationFromLines([
      { text: firstLine, html: `${author ? escapeHtml(period(author)) + ' ' : ''}${titleHtml}` },
      { text: secondLineText, html: secondLineHtml },
      { text: accessed, html: escapeHtml(accessed) }
    ])
  };
}

function buildApa(fields) {
  // APA 7: no individual author → use org name as-is, or move page title to author slot.
  // If org name fills the author slot and matches the site name, omit site name to avoid repetition.
  let authorValue = '';
  let siteValue = fields.websiteTitle || '';
  let authorIsTitle = false;

  if (fields.author) {
    authorValue = toLastInitials(fields.author);
  } else if (fields.websiteTitle || fields.publisher) {
    // Organization as author — use as-is (no inversion).
    authorValue = fields.websiteTitle || fields.publisher;
    // APA 7: omit site name when same as author.
    if (authorValue === fields.websiteTitle) siteValue = '';
  } else if (fields.pageTitle) {
    // No person or org — italicize title in author position.
    authorValue = fields.pageTitle;
    authorIsTitle = true;
    siteValue = '';
  } else {
    authorValue = '';
  }

  const date = toApaDate(fields.publishedDate || fields.updatedDate);
  // APA 7: title in sentence case, italicized. We don't recase user text, but we do italicize.
  const title = fields.pageTitle && !authorIsTitle ? period(fields.pageTitle) : '';
  const site = siteValue && siteValue !== authorValue ? period(siteValue) : '';
  const retrieval = fields.publishedDate ? '' : fields.accessedDate ? `Retrieved ${formatHumanDate(fields.accessedDate, 'apa')}, from` : '';
  const url = fields.url || '';

  const authorText = authorValue ? period(authorValue) : '';
  const authorHtml = authorIsTitle ? `${renderItalic(authorValue)}.` : escapeHtml(authorText);

  return {
    text: textCitationFromLines([
      { text: `${authorText} (${date}).` },
      { text: title },
      { text: site },
      { text: [retrieval, url].filter(Boolean).join(' ') }
    ]),
    html: htmlCitationFromLines([
      { text: `${authorText} (${date}).`, html: `${authorHtml} (${escapeHtml(date)}).` },
      { text: title, html: title ? renderItalic(fields.pageTitle) + '.' : '' },
      { text: site, html: site ? `${escapeHtml(site)}` : '' },
      { text: [retrieval, url].filter(Boolean).join(' '), html: escapeHtml([retrieval, url].filter(Boolean).join(' ')) }
    ])
  };
}

function buildChicagoNote(fields) {
  const author = fields.author ? `${fields.author}, ` : '';
  const title = fields.pageTitle ? `“${fields.pageTitle},” ` : '';
  const site = fields.websiteTitle || fields.publisher || '';
  const date = fields.publishedDate ? `, ${formatHumanDate(fields.publishedDate, 'apa')}` : fields.accessedDate ? `, accessed ${formatHumanDate(fields.accessedDate, 'apa')}` : '';
  const url = fields.url ? `, ${fields.url}` : '';
  const text = `${author}${title}${site}${date}${url}.`.replace(/, \./g, '.').trim();

  return {
    text,
    html: `${escapeHtml(author)}${escapeHtml(title)}${site ? renderItalic(site) : ''}${escapeHtml(date)}${escapeHtml(url)}.`.replace(/, \./g, '.').trim()
  };
}

function buildChicagoBib(fields) {
  const author = fields.author ? toLastFirst(fields.author) : '';
  const titleHtml = fields.pageTitle ? quotedHtml(fields.pageTitle) : '';
  const firstLine = [author ? period(author) : '', fields.pageTitle ? quoted(fields.pageTitle) : ''].filter(Boolean).join(' ');
  const secondLine = [fields.websiteTitle ? period(fields.websiteTitle) : fields.publisher ? period(fields.publisher) : '', fields.publishedDate ? period(formatHumanDate(fields.publishedDate, 'apa')) : fields.accessedDate ? period(`Accessed ${formatHumanDate(fields.accessedDate, 'apa')}`) : ''].filter(Boolean).join(' ');
  const thirdLine = fields.url ? period(fields.url) : '';

  return {
    text: textCitationFromLines([
      { text: firstLine },
      { text: secondLine },
      { text: thirdLine }
    ]),
    html: htmlCitationFromLines([
      { text: firstLine, html: `${author ? escapeHtml(period(author)) + ' ' : ''}${titleHtml}` },
      { text: secondLine, html: `${fields.websiteTitle ? renderItalic(fields.websiteTitle) + '.' : fields.publisher ? escapeHtml(period(fields.publisher)) : ''}${fields.publishedDate ? ' ' + escapeHtml(period(formatHumanDate(fields.publishedDate, 'apa'))) : fields.accessedDate ? ' ' + escapeHtml(period(`Accessed ${formatHumanDate(fields.accessedDate, 'apa')}`)) : ''}`.trim() },
      { text: thirdLine, html: escapeHtml(thirdLine) }
    ])
  };
}
function buildCitation(fields) {
  switch (state.format) {
    case 'apa':
      return buildApa(fields);
    case 'chicago-note':
      return buildChicagoNote(fields);
    case 'chicago-bib':
      return buildChicagoBib(fields);
    case 'mla':
    default:
      return buildMla(fields);
  }
}

function updateCitation() {
  const citation = buildCitation(getFieldValues());
  citationOutput.value = citation.text;
  citationPreview.innerHTML = citation.html || escapeHtml(citation.text).replace(/\n/g, '<br>');
}

function setFormat(format) {
  state.format = format;
  formatButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.format === format);
  });
  chrome.storage.local.set({ [FORMAT_STORAGE_KEY]: format });
  updateCitation();
}

async function loadSavedFormat() {
  const stored = await chrome.storage.local.get(FORMAT_STORAGE_KEY);
  setFormat(stored[FORMAT_STORAGE_KEY] || DEFAULT_FORMAT);
}

async function extractFromActiveTab() {
  copyStatus.textContent = '';
  statusBox.textContent = 'Reading this page…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found.');

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'WEBCITE_EXTRACT' });
    } catch (_messageError) {
      if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
        throw new Error('Restricted page.');
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      response = await chrome.tabs.sendMessage(tab.id, { type: 'WEBCITE_EXTRACT' });
    }

    if (!response?.ok) throw new Error('Could not read page metadata.');

    setFieldValues(response.data);
    statusBox.textContent = 'Fields extracted. Review confidence labels before copying.';
  } catch (error) {
    statusBox.textContent = 'Could not read this page. Chrome system pages and some restricted pages are blocked. You can still enter citation fields manually.';
    const today = new Date().toISOString().slice(0, 10);
    setFieldValues({
      accessedDate: { value: today, confidence: 'high', source: 'Generated today' }
    });
  }
}

async function copyCitation() {
  const citation = buildCitation(getFieldValues());
  const richHtml = `<div style="font-family: Times New Roman, serif; font-size: 12pt; line-height: 2; margin-left: 0.5in; text-indent: -0.5in;">${citation.html}</div>`;

  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([citation.text], { type: 'text/plain' }),
          'text/html': new Blob([richHtml], { type: 'text/html' })
        })
      ]);
      copyStatus.textContent = 'Copied with formatting.';
    } else {
      await navigator.clipboard.writeText(citation.text);
      copyStatus.textContent = 'Copied plain text.';
    }
    setTimeout(() => { copyStatus.textContent = ''; }, 1800);
  } catch (_error) {
    try {
      await navigator.clipboard.writeText(citation.text);
      copyStatus.textContent = 'Copied plain text.';
      setTimeout(() => { copyStatus.textContent = ''; }, 1800);
    } catch (__error) {
      copyStatus.textContent = 'Copy failed. Select the citation text manually.';
    }
  }
}

FIELD_IDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    markEditedField(id);
    updateCitation();
  });
});

formatButtons.forEach((button) => {
  button.addEventListener('click', () => setFormat(button.dataset.format));
});

copyButton.addEventListener('click', copyCitation);
refreshButton.addEventListener('click', extractFromActiveTab);

loadSavedFormat().then(extractFromActiveTab);
