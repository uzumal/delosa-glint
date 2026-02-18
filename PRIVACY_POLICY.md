# Privacy Policy — Delosa Glint

**Last updated:** February 18, 2026

## Overview

Delosa Glint is a Chrome extension that monitors web page changes and browser events, then sends webhook notifications to user-configured endpoints. We are committed to protecting your privacy.

## Data Collection

**Delosa Glint does not collect any personal data.**

The extension stores the following data locally on your device using `chrome.storage.local`:

| Data | Purpose |
|------|---------|
| Monitoring rules | URL patterns, CSS selectors, and webhook destination URLs that you configure |
| Webhook logs | Delivery status codes and timestamps of webhook requests |
| DOM snapshots | Text content of monitored elements for change detection |
| Settings | Application preferences (e.g., notification toggle) |

**None of this data is transmitted to the extension developer or any third party.**

## Data Transmission

The only outbound network requests made by this extension are webhook HTTP requests to endpoints **explicitly configured by you**. The extension developer does not operate any server that receives data from this extension.

## Data Storage

All data is stored locally in your browser using the Chrome Storage API (`chrome.storage.local`). No data is stored on external servers. Uninstalling the extension removes all stored data.

## Third-Party Services

This extension does not integrate with any analytics, advertising, or tracking services.

## Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access the current tab to activate the visual element selector when you click "Pick element" |
| `storage` | Save your monitoring rules, logs, and settings locally |
| `alarms` | Schedule periodic checks for monitoring rules |
| `notifications` | Display desktop notifications for webhook delivery results |
| `scripting` | Inject the visual element selector script into the active tab on your request |
| `host_permissions` | Monitor DOM changes on any website you specify (content script) |

## Children's Privacy

This extension is not directed at children under the age of 13 and does not knowingly collect personal information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted in this document with an updated "Last updated" date.

## Contact

If you have any questions about this Privacy Policy, please open an issue on the [GitHub repository](https://github.com/your-username/delosa-glint/issues).
