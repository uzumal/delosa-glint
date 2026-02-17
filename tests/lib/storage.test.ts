import { StorageHelper } from "@/lib/storage";
import { Rule, LogEntry } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Test",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://*",
  selector: "#el",
  destination: { id: "d1", url: "https://example.com", label: "Test" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Test",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://example.com",
  timestamp: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
});

describe("rules", () => {
  test("getRules returns empty array when no rules", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    expect(await StorageHelper.getRules()).toEqual([]);
  });

  test("getRules returns stored rules", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    expect(await StorageHelper.getRules()).toEqual([mockRule]);
  });

  test("saveRule adds new rule", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });
    await StorageHelper.saveRule(mockRule);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [mockRule] });
  });

  test("saveRule updates existing rule by id", async () => {
    const updated = { ...mockRule, name: "Updated" };
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    await StorageHelper.saveRule(updated);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [updated] });
  });

  test("deleteRule removes rule by id", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    await StorageHelper.deleteRule("r1");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [] });
  });
});

describe("logs", () => {
  test("getLogs returns empty array when no logs", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    expect(await StorageHelper.getLogs()).toEqual([]);
  });

  test("addLog prepends to existing logs", async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "logs") return Promise.resolve({ logs: [] });
      if (key === "settings") return Promise.resolve({});
      return Promise.resolve({});
    });
    await StorageHelper.addLog(mockLog);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ logs: [mockLog] });
  });

  test("clearLogs empties log array", async () => {
    await StorageHelper.clearLogs();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ logs: [] });
  });
});

describe("settings", () => {
  test("getSettings returns defaults when none stored", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    const settings = await StorageHelper.getSettings();
    expect(settings.enableNotifications).toBe(true);
    expect(settings.maxLogEntries).toBe(500);
  });

  test("saveSettings merges with existing", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    await StorageHelper.saveSettings({ enableNotifications: false });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      settings: { enableNotifications: false, maxLogEntries: 500 },
    });
  });
});
