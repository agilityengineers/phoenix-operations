import type { Contact } from "../types";

// Pluggable connector layer — add a tool by implementing Connector and
// registering it in registry.ts; no refactoring of call sites required.

export type OutboundEvent =
  | "lead.created"
  | "intake.completed"
  | "lead.qualified"
  | "stage.changed";

export interface LeadEventPayload {
  event: OutboundEvent;
  lead: {
    id: string;
    name: string;
    email: string;
    company: string;
    funnel: string;
    score: number;
    tags: string[];
    utm: Record<string, string | undefined>;
  };
  occurred_at: string;
  [key: string]: unknown;
}

export interface Connector {
  name: string;
  /** True when the env vars this connector needs are present. */
  configured(): boolean;
  /** React to a lead lifecycle event. Never throws — logs and returns. */
  onEvent(event: OutboundEvent, contact: Contact, extra?: Record<string, unknown>): Promise<void>;
}

export function buildLeadPayload(
  event: OutboundEvent,
  contact: Contact,
  extra?: Record<string, unknown>
): LeadEventPayload {
  return {
    event,
    lead: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      company: contact.company,
      funnel: contact.funnel,
      score: contact.score,
      tags: contactTags(contact.score),
      utm: {
        source: contact.utm?.utm_source,
        medium: contact.utm?.utm_medium,
        campaign: contact.utm?.utm_campaign,
      },
    },
    occurred_at: new Date().toISOString(),
    ...(extra ?? {}),
  };
}

function contactTags(score: number): string[] {
  const tags = [score >= 70 && "coachable", score >= 75 && "icp-fit", score >= 85 && "hot"].filter(
    Boolean
  ) as string[];
  return tags.length ? tags : ["low-fit"];
}
