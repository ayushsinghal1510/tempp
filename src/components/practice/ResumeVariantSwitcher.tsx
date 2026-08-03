"use client";

import { useRouter } from "next/navigation";

type Variant = {
  id: string;
  companyId: string | null;
  company: { companyName: string } | null;
};

/**
 * Switches between the base resume and its tailored variants.
 *
 * A <select> and not tabs: a student assigned to a batch of eight companies
 * would push a tab row off the side of the card, and this sits in a header that
 * already competes for width with the page title.
 */
export default function ResumeVariantSwitcher({
  variants,
  currentCompanyId,
}: {
  variants: Variant[];
  currentCompanyId: string | null;
}) {
  const router = useRouter();

  // Only worth rendering once there is somewhere else to go.
  if (variants.length < 2) return null;

  return (
    <select
      value={currentCompanyId ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        router.push(
          next
            ? `/practice/resume-studio?company=${encodeURIComponent(next)}`
            : "/practice/resume-studio",
        );
      }}
      className="rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand"
    >
      {variants.map((v) => (
        <option key={v.id} value={v.companyId ?? ""}>
          {v.companyId
            ? `Tailored — ${v.company?.companyName ?? "company"}`
            : "Base resume"}
        </option>
      ))}
    </select>
  );
}
