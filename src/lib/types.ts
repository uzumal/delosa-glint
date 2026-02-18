export type TriggerType =
  | "page_visit"
  | "dom_change"
  | "click"
  | "form_submit"
  | "periodic_check";

export type DestinationType = "generic" | "text";

export interface Destination {
  id: string;
  type: DestinationType;
  url: string;
  label: string;
  headers?: Record<string, string>;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerType;
  urlPattern: string;
  selector?: string;
  intervalMinutes?: number;
  destination: Destination;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookPayload {
  event: TriggerType;
  rule: { id: string; name: string };
  source: { url: string; selector?: string };
  change: {
    type: string;
    previous?: string;
    current?: string;
  };
  timestamp: string;
  meta: {
    browser: string;
    extensionVersion: string;
  };
  powered_by: string;
}

export interface LogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  event: TriggerType;
  status: "success" | "failure";
  statusCode?: number;
  destinationUrl: string;
  timestamp: string;
  payload?: WebhookPayload;
  error?: string;
}

export interface ExtensionSettings {
  enableNotifications: boolean;
  maxLogEntries: number;
}

export type MessageType =
  | "ELEMENT_SELECTED"
  | "DOM_CHANGED"
  | "FORM_SUBMITTED"
  | "CLICK_EVENT"
  | "PAGE_VISITED"
  | "ACTIVATE_SELECTOR"
  | "DEACTIVATE_SELECTOR"
  | "INJECT_SELECTOR";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}
