import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { LogList } from "@/popup/components/LogList";
import { LogEntry } from "@/lib/types";

const successLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Price Watcher",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-15T12:30:00Z",
};

const failureLog: LogEntry = {
  id: "l2",
  ruleId: "r1",
  ruleName: "Price Watcher",
  event: "dom_change",
  status: "failure",
  statusCode: 500,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-15T12:31:00Z",
  error: "HTTP 500 Internal Server Error",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("shows empty state when no logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});

test("renders log entries", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog, failureLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getAllByText("Price Watcher")).toHaveLength(2);
});

test("shows success indicator for successful logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText("200")).toBeTruthy();
});

test("shows error message for failed logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [failureLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText("HTTP 500 Internal Server Error")).toBeTruthy();
});

test("clear button clears all logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  render(<LogList />);
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [] });
  await act(async () => {
    fireEvent.click(screen.getByText("Clear"));
  });
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});
