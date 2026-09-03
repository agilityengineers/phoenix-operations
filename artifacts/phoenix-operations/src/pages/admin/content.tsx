import { useQuery } from "@tanstack/react-query";
import CmsManager from "@/components/admin/CmsManager";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function ContentPage() {
  const store = getStore();

  const { data: pages, isLoading } = useQuery({
    queryKey: ["cmsPages"],
    queryFn: () => store.listCmsPages(),
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!pages) return null;

  return <CmsManager initialPages={pages} />;
}
