import PipelineBoard from "@/components/admin/PipelineBoard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const store = getStore();
  const [pipelines, contacts] = await Promise.all([store.listPipelines(), store.listContacts()]);
  return <PipelineBoard pipelines={pipelines} initialContacts={contacts} />;
}
