import CmsManager from "@/components/admin/CmsManager";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const pages = await getStore().listCmsPages();
  return <CmsManager initialPages={pages} />;
}
