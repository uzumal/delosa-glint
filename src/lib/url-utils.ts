const BLOCKED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "edge://",
  "brave://",
  "opera://",
  "vivaldi://",
  "devtools://",
];

export function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !BLOCKED_PREFIXES.some((prefix) => url.startsWith(prefix));
}
