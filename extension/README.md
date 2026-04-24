# Refund Status Companion Extension

This Chrome extension works only on the official Income Tax portal and extracts non-sensitive return status data after the user is already logged in there.

## What it does

- reads the current filed-return page
- looks for the selected assessment year card
- extracts PAN, latest visible status, and date
- opens the companion webpage with those values in the URL

## Load locally in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `extension` folder

## Usage

1. Open the official portal and log in there directly.
2. Go to `e-File -> Income Tax Returns -> View Filed Returns`.
3. Open the extension.
4. Choose the assessment year.
5. Click `Extract and open webpage`.

## Note

The extraction is DOM-based, so if the portal layout changes, `content.js` may need a small update.
