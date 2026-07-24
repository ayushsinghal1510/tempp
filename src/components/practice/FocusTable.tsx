import { cn } from "@/lib/utils";
import type { ExpectationEntry } from "@/lib/research/expectationMatrix";

/** The 12-criterion degree/academic-tier weight table — a real table (not a
 * truncated bar chart) so every criterion and its weight is legible at once. */
export default function FocusTable({ focus }: { focus: ExpectationEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
          <tr>
            <th className="px-4 py-2.5">Focus area</th>
            <th className="px-4 py-2.5">Weight</th>
          </tr>
        </thead>
        <tbody>
          {focus.map((f, i) => (
            <tr key={f.key} className="border-t border-line">
              <td
                className={cn(
                  "px-4 py-2.5",
                  i < 2 ? "font-semibold text-ink" : "text-ink",
                )}
              >
                {f.label}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "h-2 w-2 rounded-full",
                          d < f.weight ? "bg-brand" : "bg-line",
                        )}
                      />
                    ))}
                  </div>
                  <span className="tabular-nums text-xs text-muted">
                    {f.weight}/5
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
