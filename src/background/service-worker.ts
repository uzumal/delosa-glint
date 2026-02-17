import { StorageHelper } from "@/lib/storage";
import { WebhookSender } from "@/lib/webhook";
import { isInjectableUrl } from "@/lib/url-utils";
import { ExtensionMessage, LogEntry, Rule, TriggerType, WebhookPayload } from "@/lib/types";

const EXTENSION_VERSION = "0.1.0";

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "ELEMENT_SELECTED":
      return handleElementSelected(message.payload as { selector: string; url: string });

    case "DOM_CHANGED":
      return handleDomChanged(
        message.payload as {
          ruleId: string;
          selector: string;
          previous: string;
          current: string;
          url: string;
        },
      );

    case "FORM_SUBMITTED":
      return handleFormSubmitted(
        message.payload as { ruleId: string; formData: Record<string, string>; url: string },
      );

    case "CLICK_EVENT":
      return handleClickEvent(
        message.payload as { ruleId: string; selector: string; url: string },
      );

    case "PAGE_VISITED":
      return handlePageVisited(
        message.payload as { ruleId: string; url: string },
      );

    case "INJECT_SELECTOR": {
      const { tabId } = message.payload as { tabId: number };
      const tab = await chrome.tabs.get(tabId);
      if (!isInjectableUrl(tab.url)) {
        return { error: "Cannot inject into this page. Navigate to a regular web page first." };
      }
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/selector.js"],
      });
      return { success: true };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

async function handleElementSelected(payload: {
  selector: string;
  url: string;
}): Promise<unknown> {
  // Store the selected element info for the popup to use during rule creation
  await chrome.storage.local.set({ pendingSelection: payload });
  return { success: true };
}

async function handleDomChanged(payload: {
  ruleId: string;
  selector: string;
  previous: string;
  current: string;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "dom_change", {
    type: "mutation",
    previous: payload.previous,
    current: payload.current,
  });
}

async function handleFormSubmitted(payload: {
  ruleId: string;
  formData: Record<string, string>;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "form_submit", {
    type: "submit",
    current: JSON.stringify(payload.formData),
  });
}

async function handleClickEvent(payload: {
  ruleId: string;
  selector: string;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "click", {
    type: "click",
    current: payload.selector,
  });
}

async function handlePageVisited(payload: {
  ruleId: string;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "page_visit", {
    type: "visit",
    current: payload.url,
  });
}

async function dispatchWebhook(
  rule: Rule,
  event: TriggerType,
  change: { type: string; previous?: string; current?: string },
): Promise<unknown> {
  const webhookPayload: WebhookPayload = {
    event,
    rule: { id: rule.id, name: rule.name },
    source: { url: rule.urlPattern, selector: rule.selector },
    change,
    timestamp: new Date().toISOString(),
    meta: {
      browser: "chrome",
      extensionVersion: EXTENSION_VERSION,
    },
    powered_by: "BrowserHook",
  };

  const result = await WebhookSender.send(rule.destination, webhookPayload);

  const log: LogEntry = {
    id: crypto.randomUUID(),
    ruleId: rule.id,
    ruleName: rule.name,
    event,
    status: result.success ? "success" : "failure",
    statusCode: result.statusCode,
    destinationUrl: rule.destination.url,
    timestamp: new Date().toISOString(),
    payload: webhookPayload,
    error: result.error,
  };
  await StorageHelper.addLog(log);

  return { success: result.success };
}

// Alarm handler for periodic checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("rule:")) return;
  const ruleId = alarm.name.replace("rule:", "");
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule || !rule.enabled) return;

  await dispatchWebhook(rule, "periodic_check", { type: "scheduled" });
});

// Set up alarms for periodic rules on install/startup
async function setupAlarms(): Promise<void> {
  const rules = await StorageHelper.getRules();
  for (const rule of rules) {
    if (rule.trigger === "periodic_check" && rule.enabled && rule.intervalMinutes) {
      chrome.alarms.create(`rule:${rule.id}`, {
        periodInMinutes: rule.intervalMinutes,
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
});
