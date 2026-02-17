export function validateRuleName(name: string): string | null {
  if (!name.trim()) return "Rule name is required";
  if (name.length > 100) return "Rule name must be 100 characters or less";
  return null;
}

export function validateUrlPattern(pattern: string): string | null {
  if (!pattern.trim()) return "URL pattern is required";
  return null;
}

export function validateWebhookUrl(url: string): string | null {
  if (!url.trim()) return "Webhook URL is required";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Must be a valid URL (http:// or https://)";
    }
    return null;
  } catch {
    return "Must be a valid URL (http:// or https://)";
  }
}

export function validateSelector(selector: string): string | null {
  if (!selector.trim()) return "CSS selector is required";
  return null;
}
