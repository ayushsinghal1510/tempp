import EducatorSkeleton from "@/components/educator/EducatorSkeleton";

export default function Loading() {
  return (
    <EducatorSkeleton
      title="Classes"
      variant="table"
      message="Loading classes…"
    />
  );
}
