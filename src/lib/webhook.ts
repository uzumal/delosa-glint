import { Destination, WebhookPayload } from "./types";

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

const MAX_VALUE_LENGTH = 200;

function sanitize(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_VALUE_LENGTH) return collapsed;
  return collapsed.substring(0, MAX_VALUE_LENGTH) + "\u2026";
}

function formatMessage(payload: WebhookPayload): string {
  const lines: string[] = [`[${payload.rule.name}] ${payload.event}`];
  if (payload.change.current) lines.push(sanitize(payload.change.current));
  if (payload.change.previous) lines.push(`Previous: ${sanitize(payload.change.previous)}`);
  lines.push(`Source: ${payload.source.url}`);
  return lines.join("\n");
}

function buildBody(destination: Destination, payload: WebhookPayload): string {
  const type = destination.type ?? "generic";
  if (type === "text") {
    return JSON.stringify({ text: formatMessage(payload) });
  }
  return JSON.stringify(payload);
}

export class WebhookSender {
  static async send(destination: Destination, payload: WebhookPayload): Promise<WebhookResult> {
    try {
      const response = await fetch(destination.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...destination.headers,
        },
        body: buildBody(destination, payload),
      });

      return {
        success: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
