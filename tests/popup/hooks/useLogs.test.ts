import { renderHook, act } from "@testing-library/react";
import { useLogs } from "@/popup/hooks/useLogs";
import { LogEntry } from "@/lib/types";

const mockLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Test Rule",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-01T12:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("loads logs from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [mockLog] });
  const { result } = renderHook(() => useLogs());
  await act(async () => {});
  expect(result.current.logs).toEqual([mockLog]);
  expect(result.current.loading).toBe(false);
});

test("returns empty array when no logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  const { result } = renderHook(() => useLogs());
  await act(async () => {});
  expect(result.current.logs).toEqual([]);
});

test("clearLogs empties the list", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [mockLog] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useLogs());
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [] });
  await act(async () => {
    await result.current.clearLogs();
  });
  expect(result.current.logs).toEqual([]);
});
