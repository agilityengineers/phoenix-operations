import { useQuery } from "@tanstack/react-query";
import WhiteLabelEditor from "@/components/admin/WhiteLabelEditor";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function WhiteLabelPage() {
  const store = getStore();

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => store.getWorkspace(),
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!workspace) return null;

  return <WhiteLabelEditor initial={workspace} />;
}
