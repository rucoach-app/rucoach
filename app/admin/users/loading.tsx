import { ADMIN_DATA_PAGE_SHELL } from "@/components/admin/admin-page-header";
import { AdminPageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function UsersLoading() {
  return (
    <div className="min-h-full bg-background">
      <AdminPageHeaderSkeleton />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}

