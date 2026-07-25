import EducatorSkeleton from "@/components/educator/EducatorSkeleton";

export default function Loading() {
  return (
    <EducatorSkeleton
      title="Students"
      variant="table"
      message="Loading students…"
    />
  );
}
