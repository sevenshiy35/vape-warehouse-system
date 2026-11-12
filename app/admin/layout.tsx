import { redirect } from "next/navigation";
import { isWarehouseAdmin } from "@/lib/warehouseAuth";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isWarehouseAdmin())) redirect("/login?next=/admin/warehouse");
  return children;
}
