import {
  validateRuleName,
  validateUrlPattern,
  validateWebhookUrl,
  validateSelector,
} from "@/lib/validators";

describe("validateRuleName", () => {
  test("returns null for valid name", () => {
    expect(validateRuleName("Price Watch")).toBeNull();
  });

  test("returns error for empty name", () => {
    expect(validateRuleName("")).toBe("Rule name is required");
  });

  test("returns error for whitespace-only name", () => {
    expect(validateRuleName("   ")).toBe("Rule name is required");
  });

  test("returns error for name exceeding 100 chars", () => {
    expect(validateRuleName("a".repeat(101))).toBe("Rule name must be 100 characters or less");
  });
});

describe("validateUrlPattern", () => {
  test("returns null for valid pattern", () => {
    expect(validateUrlPattern("https://example.com/*")).toBeNull();
  });

  test("returns error for empty pattern", () => {
    expect(validateUrlPattern("")).toBe("URL pattern is required");
  });
});

describe("validateWebhookUrl", () => {
  test("returns null for valid https URL", () => {
    expect(validateWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx")).toBeNull();
  });

  test("returns null for valid http URL", () => {
    expect(validateWebhookUrl("http://localhost:3000/webhook")).toBeNull();
  });

  test("returns error for empty URL", () => {
    expect(validateWebhookUrl("")).toBe("Webhook URL is required");
  });

  test("returns error for invalid URL", () => {
    expect(validateWebhookUrl("not-a-url")).toBe("Must be a valid URL (http:// or https://)");
  });

  test("returns error for non-http protocol", () => {
    expect(validateWebhookUrl("ftp://example.com/hook")).toBe("Must be a valid URL (http:// or https://)");
  });
});

describe("validateSelector", () => {
  test("returns null for valid selector", () => {
    expect(validateSelector("#price")).toBeNull();
  });

  test("returns error for empty selector", () => {
    expect(validateSelector("")).toBe("CSS selector is required");
  });
});
