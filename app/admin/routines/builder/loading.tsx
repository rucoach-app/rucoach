import { ADMIN_DATA_PAGE_SHELL } from "@/components/admin/admin-page-header";
import { AdminPageHeaderSkeleton, RoutineBuilderContentSkeleton } from "@/components/skeletons";

export default function RoutineBuilderLoading() {
  return (
    <div className="min-h-full bg-background">
      <AdminPageHeaderSkeleton hasBackButton />
      <div className={ADMIN_DATA_PAGE_SHELL}>
        <RoutineBuilderContentSkeleton />
      </div>
    </div>
  );
}

