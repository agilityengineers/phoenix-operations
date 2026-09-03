import { useQuery } from "@tanstack/react-query";
import PipelineBoard from "@/components/admin/PipelineBoard";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function ContactsPage() {
  const store = getStore();

  const { data, isLoading } = useQuery({
    queryKey: ["contactsAndPipelines"],
    queryFn: async () => {
      const [pipelines, contacts] = await Promise.all([store.listPipelines(), store.listContacts()]);
      return { pipelines, contacts };
    },
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!data) return null;

  return <PipelineBoard pipelines={data.pipelines} initialContacts={data.contacts} />;
}
