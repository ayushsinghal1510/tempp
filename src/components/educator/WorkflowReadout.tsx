import type { CustomWorkflow } from "@/lib/voice/workflowCustoms";

/**
 * The greeting and prompt, shown and not editable.
 *
 * The read-only twin of WorkflowEditor, for tenants whose simulation is
 * compiled in rather than authored (`features.roleplay`, today just `mm`). The
 * admin still needs to read the whole thing — they are the one reviewing the
 * sessions it produced, and judging an officer's handling of Mr Muthu without
 * being able to see what Muthu was told to do is guesswork.
 *
 * Deliberately NOT a disabled WorkflowEditor. A greyed-out textarea with a
 * greyed-out Save under it reads as "you lack permission" or "this is
 * temporarily locked"; this is neither. The prompt is part of the product, so
 * it is presented as something to read.
 *
 * A server component on purpose — there is no state and no action to call, so
 * none of this needs to reach the browser as JavaScript.
 */
export default function WorkflowReadout({
  workflow,
}: {
  workflow: CustomWorkflow;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-medium text-muted">Greeting</div>
        <p className="mt-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">
          {workflow.greeting}
        </p>
        <p className="mt-1 text-xs text-faint">
          Spoken first, before your officer has said anything.
        </p>
      </div>

      <div>
        <div className="text-xs font-medium text-muted">Prompt</div>
        {/* whitespace-pre-wrap, not <pre>: the prompt is long-form markdown-ish
            text whose blank lines and indentation carry structure, but which
            must still wrap rather than scroll sideways on a narrow screen. */}
        <div className="mt-1 max-h-[32rem] overflow-y-auto rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {workflow.prompt}
        </div>
        <p className="mt-1 text-xs text-faint">
          Fixed for every session in your organisation. We append only the two
          notes that belong to the voice channel — who the officer is, and that
          numbers must be spoken as words.
        </p>
      </div>
    </div>
  );
}
