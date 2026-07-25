import EducatorSkeleton from "@/components/educator/EducatorSkeleton";

export default function Loading() {
  return (
    <EducatorSkeleton
      title="Session"
      variant="detail"
      message="Loading session…"
    />
  );
}
