import type { Contact } from "../types";
import { hubspotConnector } from "./hubspot";
import { sendgridConnector } from "./sendgrid";
import type { Connector, OutboundEvent } from "./types";
import { zapierConnector } from "./zapier";

// Add a new tool here — nothing else changes.
const connectors: Connector[] = [zapierConnector, sendgridConnector, hubspotConnector];

export async function dispatchEvent(
  event: OutboundEvent,
  contact: Contact,
  extra?: Record<string, unknown>
): Promise<void> {
  await Promise.all(connectors.map((c) => c.onEvent(event, contact, extra)));
}
