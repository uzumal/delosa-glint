import { WebhookSender } from "@/lib/webhook";
import { Destination, WebhookPayload } from "@/lib/types";

const mockDestination: Destination = {
  id: "d1",
  type: "generic",
  url: "https://hooks.example.com/webhook",
  label: "Test Hook",
};

const mockPayload: WebhookPayload = {
  event: "dom_change",
  rule: { id: "r1", name: "Test Rule" },
  source: { url: "https://example.com", selector: "#price" },
  change: { type: "mutation", previous: "$10", current: "$12" },
  timestamp: "2026-01-01T00:00:00Z",
  meta: { browser: "chrome", extensionVersion: "0.1.0" },
  powered_by: "Delosa Glint",
};

beforeEach(() => {
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  delete (global as any).fetch;
});

test("sends POST request with correct headers and body", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  await WebhookSender.send(mockDestination, mockPayload);

  expect(fetch).toHaveBeenCalledWith("https://hooks.example.com/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mockPayload),
  });
});

test("returns success for 2xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(true);
  expect(result.statusCode).toBe(200);
  expect(result.error).toBeUndefined();
});

test("returns failure for 4xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.statusCode).toBe(404);
  expect(result.error).toBe("HTTP 404 Not Found");
});

test("returns failure for 5xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
  });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.statusCode).toBe(500);
});

test("returns failure on network error", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("Network failure"));

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.error).toBe("Network failure");
  expect(result.statusCode).toBeUndefined();
});

test("includes custom headers from destination", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  const dest: Destination = {
    ...mockDestination,
    headers: { Authorization: "Bearer token123" },
  };

  await WebhookSender.send(dest, mockPayload);

  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
    }),
  );
});
