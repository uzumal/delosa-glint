import { isInjectableUrl } from "@/lib/url-utils";

describe("isInjectableUrl", () => {
  test("returns true for https URLs", () => {
    expect(isInjectableUrl("https://example.com")).toBe(true);
  });

  test("returns true for http URLs", () => {
    expect(isInjectableUrl("http://localhost:3000")).toBe(true);
  });

  test("returns false for chrome:// URLs", () => {
    expect(isInjectableUrl("chrome://extensions")).toBe(false);
  });

  test("returns false for chrome-extension:// URLs", () => {
    expect(isInjectableUrl("chrome-extension://abc/popup.html")).toBe(false);
  });

  test("returns false for about: URLs", () => {
    expect(isInjectableUrl("about:blank")).toBe(false);
  });

  test("returns false for edge:// URLs", () => {
    expect(isInjectableUrl("edge://settings")).toBe(false);
  });

  test("returns false for undefined/empty", () => {
    expect(isInjectableUrl(undefined)).toBe(false);
    expect(isInjectableUrl("")).toBe(false);
  });
});
