import { renderHook, act } from "@testing-library/react";
import { useRules } from "@/popup/hooks/useRules";
import { Rule } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Test Rule",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "d1", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("loads rules from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  const { result } = renderHook(() => useRules());

  // Initially loading
  expect(result.current.loading).toBe(true);

  // Wait for effect
  await act(async () => {});

  expect(result.current.rules).toEqual([mockRule]);
  expect(result.current.loading).toBe(false);
});

test("returns empty array when no rules stored", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  expect(result.current.rules).toEqual([]);
});

test("saveRule adds a new rule and refreshes", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  // After save, re-fetch returns the new rule
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  await act(async () => {
    await result.current.saveRule(mockRule);
  });

  expect(result.current.rules).toEqual([mockRule]);
});

test("deleteRule removes rule and refreshes", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });

  await act(async () => {
    await result.current.deleteRule("r1");
  });

  expect(result.current.rules).toEqual([]);
});

test("toggleRule flips enabled and saves", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  const toggled = { ...mockRule, enabled: false };
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [toggled] });

  await act(async () => {
    await result.current.toggleRule("r1");
  });

  expect(result.current.rules[0].enabled).toBe(false);
});
