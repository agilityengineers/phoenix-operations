import { notFound } from "next/navigation";
import ContactDetail from "@/components/admin/ContactDetail";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getStore();
  const contact = await store.getContact(id);
  if (!contact) notFound();
  const [activities, pipelines] = await Promise.all([
    store.listActivities(id),
    store.listPipelines(),
  ]);
  const pipeline = pipelines.find((p) => p.id === contact.pipelineId);
  return (
    <ContactDetail
      contact={contact}
      initialActivities={activities}
      stageName={pipeline?.stages[contact.stage] ?? "—"}
    />
  );
}
