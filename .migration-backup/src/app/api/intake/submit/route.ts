import { NextResponse } from "next/server";
import { dispatchEvent } from "@/lib/connectors/registry";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { computeScore, isQualified } from "@/lib/scoring";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";
import type { IntakeAnswers, UtmParams } from "@/lib/types";

// Final intake submission:
//   honeypot + rate limit → score server-side → create/refresh the contact →
//   log activity timeline → fire lead.created / intake.completed /
//   lead.qualified through the connector layer (Zapier, SendGrid, HubSpot).

type Body = {
  funnelSlug?: string;
  variant?: string;
  resumeToken?: string;
  answers?: IntakeAnswers;
  utm?: UtmParams;
  website?: string; // honeypot — humans never fill this
};

export async function POST(req: Request) {
  if (!rateLimit(`submit:${clientKey(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot tripped: pretend success, create nothing.
  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, contactId: null });
  }

  const answers = body.answers ?? {};
  const name = (answers.name ?? "").trim();
  const email = (answers.email ?? "").trim();
  if (!body.funnelSlug || !name || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const store = getStore();
  const funnel = await store.getFunnelBySlug(body.funnelSlug);
  if (!funnel) return NextResponse.json({ error: "unknown_funnel" }, { status: 404 });

  const score = computeScore(answers);
  const utm = body.utm ?? {};
  const source = utm.utm_source
    ? `${utm.utm_source} / ${utm.utm_medium ?? "direct"}`
    : utm.referrer
      ? "referral"
      : "direct";

  // Dedupe on email: a resubmission refreshes the existing contact.
  const existing = (await store.listContacts()).find(
    (c) => c.email.toLowerCase() === email.toLowerCase()
  );

  const contact = existing
    ? (await store.updateContact(existing.id, { score, answers, utm }))!
    : await store.createContact({
        workspaceId: WORKSPACE_ID,
        pipelineId: "prospects",
        name,
        company: (answers.company ?? "").trim() || "—",
        role: answers.role ?? "—",
        email,
        phone: answers.phone,
        funnel: funnel.name,
        source,
        score,
        stage: 0,
        position: 0,
        owner: "—",
        answers,
        utm,
      });

  // Mark the intake session submitted (idempotent).
  if (body.resumeToken) {
    await store.upsertIntakeSession({
      id: body.resumeToken,
      workspaceId: WORKSPACE_ID,
      funnelSlug: body.funnelSlug,
      variant: String(body.variant ?? "A"),
      resumeToken: body.resumeToken,
      step: 5,
      answers,
      utm,
      submitted: true,
    });
  }

  // Activity timeline entries.
  const leastControl = (answers.leastControl ?? []).join(", ");
  await store.addActivity({
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    type: "intake_completed",
    title: `Intake completed — scored ${score}`,
    body: [
      leastControl && `Least control: ${leastControl}.`,
      answers.bounceback && `"${answers.bounceback}"`,
      answers.coachAdmit &&
        answers.coachOpen &&
        `Coachability ${answers.coachAdmit}/5 and ${answers.coachOpen}/5.`,
    ]
      .filter(Boolean)
      .join(" "),
  });
  await store.addActivity({
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    type: "intake_started",
    title: "Intake started",
    body: `Landed on /${body.funnelSlug} (variant ${body.variant ?? "A"}) · ${source}`,
  });

  // Outbound events — soft disqualify means low scores still book;
  // lead.qualified only fires at the 70 threshold.
  await dispatchEvent("lead.created", contact);
  await dispatchEvent("intake.completed", contact);
  if (isQualified(score)) await dispatchEvent("lead.qualified", contact);

  return NextResponse.json({ ok: true, contactId: contact.id, score });
}
