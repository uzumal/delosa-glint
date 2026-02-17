describe("DOMWatcher click trigger", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  test("sends CLICK_EVENT message when matched element is clicked", async () => {
    document.body.innerHTML = '<button id="buy">Buy Now</button>';

    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      rules: [
        {
          id: "r1",
          name: "Click Rule",
          enabled: true,
          trigger: "click",
          urlPattern: "*",
          selector: "#buy",
          destination: { id: "d1", url: "https://hook.test", label: "Test" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Simulate click
    document.getElementById("buy")!.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLICK_EVENT",
        payload: expect.objectContaining({
          ruleId: "r1",
          selector: "#buy",
        }),
      }),
    );
  });
});

describe("DOMWatcher page_visit trigger", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  test("sends PAGE_VISITED message immediately for matching URL", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      rules: [
        {
          id: "r2",
          name: "Visit Rule",
          enabled: true,
          trigger: "page_visit",
          urlPattern: "*",
          destination: { id: "d1", url: "https://hook.test", label: "Test" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAGE_VISITED",
        payload: expect.objectContaining({ ruleId: "r2" }),
      }),
    );
  });
});

describe("DOMWatcher.matchesUrl", () => {
  let watcher: any;

  beforeAll(async () => {
    const mod = await import("@/content/observer");
    watcher = new mod.DOMWatcher();
  });

  test("matches wildcard pattern", () => {
    expect(watcher.matchesUrl("https://example.com/page", "https://example.com/*")).toBe(true);
  });

  test("rejects non-matching URL", () => {
    expect(watcher.matchesUrl("https://other.com", "https://example.com/*")).toBe(false);
  });

  test("matches exact URL", () => {
    expect(watcher.matchesUrl("https://example.com", "https://example.com")).toBe(true);
  });

  test("falls back to includes on invalid regex", () => {
    expect(watcher.matchesUrl("https://example.com/page", "example.com")).toBe(true);
  });
});

describe("DOMWatcher snapshot persistence", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  });

  test("detects change between sessions using persisted snapshot", async () => {
    // Element now shows "$12" but snapshot from last session was "$10"
    document.body.innerHTML = '<span id="price">$12</span>';

    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "rules") {
        return Promise.resolve({
          rules: [
            {
              id: "r1",
              name: "Price Watch",
              enabled: true,
              trigger: "dom_change",
              urlPattern: "*",
              selector: "#price",
              destination: { id: "d1", url: "https://hook.test", label: "Test" },
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }
      if (key === "snapshots") {
        return Promise.resolve({ snapshots: { r1: "$10" } });
      }
      return Promise.resolve({});
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Should detect the change from "$10" (persisted) to "$12" (current)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DOM_CHANGED",
        payload: expect.objectContaining({
          ruleId: "r1",
          previous: "$10",
          current: "$12",
        }),
      }),
    );
  });

  test("saves snapshot when element is first observed", async () => {
    document.body.innerHTML = '<span id="price">$10</span>';

    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "rules") {
        return Promise.resolve({
          rules: [
            {
              id: "r1",
              name: "Price Watch",
              enabled: true,
              trigger: "dom_change",
              urlPattern: "*",
              selector: "#price",
              destination: { id: "d1", url: "https://hook.test", label: "Test" },
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }
      if (key === "snapshots") {
        return Promise.resolve({});  // No previous snapshot
      }
      return Promise.resolve({});
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Should save the initial snapshot
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshots: expect.objectContaining({ r1: "$10" }),
      }),
    );

    // Should NOT send DOM_CHANGED since there's no previous value to compare
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "DOM_CHANGED" }),
    );
  });
});
