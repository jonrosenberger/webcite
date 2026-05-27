# WebCite

WebCite is a local-only Chrome extension for building website citations quickly.

## Features

- Extracts citation fields from the current webpage
- Uses strict fallbacks instead of broad page scraping
- Shows editable citation fields
- Shows confidence labels for each extracted field
- Supports MLA 9, APA 7, Chicago Note, and Chicago Bibliography
- Remembers the last selected format
- Renders a styled citation preview with hanging-indent layout
- Copies rich text when supported, with plain text fallback
- Requires no API, no account, no backend, and no AI

## Install locally

1. Unzip the project folder.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on Developer Mode.
4. Click **Load unpacked**.
5. Select the `webcite-extension` folder.

## Extraction philosophy

WebCite favors leaving fields blank over filling them with risky guesses.

Preferred source order:

1. JSON-LD / structured data
2. Standard metadata tags
3. Visible article/header-scoped elements
4. Cautious fallback
5. Blank

This helps avoid accidentally citing footer dates, cache timestamps, related articles, ads, or navigation content.
