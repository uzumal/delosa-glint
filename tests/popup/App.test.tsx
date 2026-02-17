import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { App } from "@/popup/App";

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
});

test("renders BrowserHook header", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText("BrowserHook")).toBeTruthy();
});

test("shows rule list by default", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText(/no rules yet/i)).toBeTruthy();
});

test("switches to create view when + button clicked", async () => {
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("Create rule"));
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
});

test("switches to logs view when log button clicked", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("View logs"));
  await act(async () => {});
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});
