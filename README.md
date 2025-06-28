# GitHub PR Title Weekly Fetcher

A Chrome extension that fetches PR titles and commit messages from GitHub repositories within the current week.

## Features

- Fetch PR titles from multiple GitHub repositories
- Filter PRs by current week (Monday to Sunday)
- Option to include commit messages from each PR
- Copy results to clipboard
- Persistent storage of URLs and settings

## Usage

1. Install the extension in Chrome
2. Click on the extension icon to open the popup
3. Add GitHub repository URLs with titles:
   - URL: GitHub closed PRs URL (e.g., `https://github.com/org/repo/pulls?q=is%3Apr+is%3Aclosed`)
   - Title: Project identifier (e.g., `C365`)
4. Check "Include commit messages from PRs" if you want to see commit details
5. Click "Fetch PR Titles" to get the results
6. Use "Copy" button to copy results to clipboard

## Output Format

### PR Titles Only
```
C365:

fix: move guid element before categories in world article rss
fix: update dependency versions
```

### With Commit Messages
```
C365:

fix: move guid element before categories in world article rss
  - Move guid element before categories in XML feed
  - Update RSS feed structure
fix: update dependency versions
  - Bump package versions
  - Fix security vulnerabilities
```

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Permissions

- `activeTab`: To interact with GitHub pages
- `storage`: To save URLs and settings locally
- `https://github.com/*`: To fetch data from GitHub repositories

## Development

The extension consists of:
- `manifest.json`: Extension configuration
- `popup.html`: User interface
- `popup.js`: Main functionality
- `background.js`: Background service worker
