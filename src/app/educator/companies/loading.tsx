import EducatorSkeleton from "@/components/educator/EducatorSkeleton";

export default function Loading() {
  return (
    <EducatorSkeleton
      title="Companies"
      variant="table"
      message="Loading companies…"
    />
  );
}
