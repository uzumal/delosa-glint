import { Rule, LogEntry, ExtensionSettings } from "./types";

const DEFAULT_SETTINGS: ExtensionSettings = {
  enableNotifications: true,
  maxLogEntries: 500,
};

export class StorageHelper {
  static async getRules(): Promise<Rule[]> {
    const result = await chrome.storage.local.get("rules");
    return (result.rules as Rule[] | undefined) ?? [];
  }

  static async saveRule(rule: Rule): Promise<void> {
    const rules = await this.getRules();
    const index = rules.findIndex((r) => r.id === rule.id);
    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.push(rule);
    }
    await chrome.storage.local.set({ rules });
  }

  static async deleteRule(ruleId: string): Promise<void> {
    const rules = await this.getRules();
    const filtered = rules.filter((r) => r.id !== ruleId);
    await chrome.storage.local.set({ rules: filtered });
  }

  static async getLogs(): Promise<LogEntry[]> {
    const result = await chrome.storage.local.get("logs");
    return (result.logs as LogEntry[] | undefined) ?? [];
  }

  static async addLog(log: LogEntry): Promise<void> {
    const logs = await this.getLogs();
    const settings = await this.getSettings();
    logs.unshift(log);
    if (logs.length > settings.maxLogEntries) {
      logs.length = settings.maxLogEntries;
    }
    await chrome.storage.local.set({ logs });
  }

  static async clearLogs(): Promise<void> {
    await chrome.storage.local.set({ logs: [] });
  }

  static async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get("settings");
    return { ...DEFAULT_SETTINGS, ...(result.settings as Partial<ExtensionSettings>) };
  }

  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({ settings: { ...current, ...settings } });
  }

  static async getSnapshot(ruleId: string): Promise<string | null> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    return snapshots[ruleId] ?? null;
  }

  static async saveSnapshot(ruleId: string, value: string): Promise<void> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    snapshots[ruleId] = value;
    await chrome.storage.local.set({ snapshots });
  }

  static async deleteSnapshot(ruleId: string): Promise<void> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    delete snapshots[ruleId];
    await chrome.storage.local.set({ snapshots });
  }
}
