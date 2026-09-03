import WhiteLabelEditor from "@/components/admin/WhiteLabelEditor";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WhiteLabelPage() {
  const workspace = await getStore().getWorkspace();
  return <WhiteLabelEditor initial={workspace} />;
}
