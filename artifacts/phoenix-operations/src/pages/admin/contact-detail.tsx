import { useQuery } from "@tanstack/react-query";
import { Redirect, useParams } from "wouter";
import ContactDetail from "@/components/admin/ContactDetail";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const store = getStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contactDetail", params?.id],
    queryFn: async () => {
      if (!params?.id) throw new Error("No id");
      const contact = await store.getContact(params.id);
      if (!contact) throw new Error("Contact not found");
      const [activities, pipelines] = await Promise.all([
        store.listActivities(params.id),
        store.listPipelines(),
      ]);
      return { contact, activities, pipelines };
    },
    enabled: !!params?.id,
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (isError || !data?.contact) {
    // Relative to the nested /admin router, so this lands on /admin/contacts.
    // <Redirect> navigates from an effect rather than mid-render.
    return <Redirect to="/contacts" replace />;
  }

  const { contact, activities, pipelines } = data;
  const pipeline = pipelines.find((p) => p.id === contact.pipelineId);

  return (
    <ContactDetail
      contact={contact}
      initialActivities={activities}
      stageName={pipeline?.stages[contact.stage] ?? "—"}
    />
  );
}
