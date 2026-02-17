import { StorageHelper } from "@/lib/storage";
import { Rule } from "@/lib/types";

export class DOMWatcher {
  private observers = new Map<string, MutationObserver>();
  private previousValues = new Map<string, string>();
  private clickHandlers = new Map<string, { element: Element; handler: EventListener }>();

  async startWatching(): Promise<void> {
    const rules = await StorageHelper.getRules();
    const currentUrl = window.location.href;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!this.matchesUrl(currentUrl, rule.urlPattern)) continue;

      if (rule.trigger === "dom_change" && rule.selector) {
        await this.observeElement(rule);
      } else if (rule.trigger === "form_submit" && rule.selector) {
        this.observeForm(rule);
      } else if (rule.trigger === "click" && rule.selector) {
        this.observeClick(rule);
      } else if (rule.trigger === "page_visit") {
        this.handlePageVisit(rule);
      }
    }
  }

  stopWatching(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    this.previousValues.clear();
    for (const { element, handler } of this.clickHandlers.values()) {
      element.removeEventListener("click", handler);
    }
    this.clickHandlers.clear();
  }

  private async observeElement(rule: Rule): Promise<void> {
    if (!rule.selector) return;
    const element = document.querySelector(rule.selector);
    if (!element) return;

    const currentText = element.textContent ?? "";
    const savedSnapshot = await StorageHelper.getSnapshot(rule.id);

    // If we have a saved snapshot and it differs, fire change event immediately
    if (savedSnapshot !== null && savedSnapshot !== currentText) {
      chrome.runtime.sendMessage({
        type: "DOM_CHANGED",
        payload: {
          ruleId: rule.id,
          selector: rule.selector,
          previous: savedSnapshot,
          current: currentText,
          url: window.location.href,
        },
      });
    }

    // Save current value as snapshot
    await StorageHelper.saveSnapshot(rule.id, currentText);
    this.previousValues.set(rule.id, currentText);

    const observer = new MutationObserver(() => {
      const current = element.textContent ?? "";
      const previous = this.previousValues.get(rule.id) ?? "";

      if (current !== previous) {
        chrome.runtime.sendMessage({
          type: "DOM_CHANGED",
          payload: {
            ruleId: rule.id,
            selector: rule.selector,
            previous,
            current,
            url: window.location.href,
          },
        });
        this.previousValues.set(rule.id, current);
        // Persist snapshot for next session
        StorageHelper.saveSnapshot(rule.id, current);
      }
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this.observers.set(rule.id, observer);
  }

  private observeForm(rule: Rule): void {
    if (!rule.selector) return;
    const form = document.querySelector(rule.selector) as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener("submit", () => {
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });

      chrome.runtime.sendMessage({
        type: "FORM_SUBMITTED",
        payload: {
          ruleId: rule.id,
          formData: data,
          url: window.location.href,
        },
      });
    });
  }

  private observeClick(rule: Rule): void {
    if (!rule.selector) return;
    const element = document.querySelector(rule.selector);
    if (!element) return;

    const handler = () => {
      chrome.runtime.sendMessage({
        type: "CLICK_EVENT",
        payload: {
          ruleId: rule.id,
          selector: rule.selector,
          url: window.location.href,
        },
      });
    };

    element.addEventListener("click", handler);
    this.clickHandlers.set(rule.id, { element, handler });
  }

  private handlePageVisit(rule: Rule): void {
    chrome.runtime.sendMessage({
      type: "PAGE_VISITED",
      payload: {
        ruleId: rule.id,
        url: window.location.href,
      },
    });
  }

  matchesUrl(url: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(url);
    } catch {
      return url.includes(pattern);
    }
  }
}

// Initialize watcher when content script loads
const watcher = new DOMWatcher();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => watcher.startWatching());
} else {
  watcher.startWatching();
}
