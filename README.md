# WebCite

WebCite is a lightweight Chrome extension that extracts webpage citation metadata and formats citations in MLA, APA, and Chicago styles.

The extension runs entirely locally in the browser:
- no accounts
- no APIs
- no tracking
- no AI generation
- no external requests beyond the current page

## Features

- Automatic webpage citation extraction
- MLA 9, APA 7, Chicago Notes, and Chicago Bibliography formats
- Editable citation fields
- Confidence indicators for extracted metadata
- Rich formatted citation preview
- One-click copy
- Persistent format preference
- Local-first architecture

## Why It Exists

Website citation tools are often:
- cluttered
- ad-heavy
- inaccurate
- opaque about where metadata came from

WebCite was built as a cleaner and more transparent alternative.

The extension intentionally prefers:

> leaving fields blank over confidently extracting incorrect information.

## Extraction Strategy

WebCite uses a confidence hierarchy when extracting metadata:

### High Confidence
- JSON-LD structured data
- standard citation meta tags

### Medium Confidence
- Open Graph metadata
- article-scoped HTML elements

### Low Confidence
- cautious fallback parsing

Fields with uncertain provenance are surfaced to the user for review and manual correction.

## Supported Citation Formats

- MLA 9
- APA 7
- Chicago Notes
- Chicago Bibliography

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to:

`chrome://extensions`

3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the extension folder

## Tech Stack

- JavaScript
- Chrome Extension APIs
- Local DOM parsing
- Structured metadata extraction
