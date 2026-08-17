// Dumps the exact `vps` customs payload to workflow-json/vps.workflow.json.
//
// Run: npx tsx scripts/dump-vps-workflow.ts
//
// The other files in workflow-json/ are hand-saved reference dumps that have
// drifted from their builders. This one is generated, so re-running it after
// editing vpsPrompt.ts or vpsCustoms.ts is how the reference stays true. It is
// a REFERENCE ONLY — nothing reads it at runtime, the live session is built by
// buildVpsCustoms in the browser.
//
// The trainee name is a placeholder: it is baked into the system prompt rather
// than passed as a workflow variable (see the note in vpsCustoms.ts), so the
// dump necessarily contains whatever name it was generated with.
//
// TWO FIELDS IN THE OUTPUT ARE DUMP ARTIFACTS, NOT WHAT SHIPS. Both come from
// values that only exist in a browser, so read them as "empty here, correct at
// runtime" rather than as bugs:
//
//   - `agent_id.webhook-url` appears as the bare path "/api/practice/webhook".
//     It is built from WEBHOOK_URL (voice/customs.ts), which is
//     NEXT_PUBLIC_WEBHOOK_URL or else `window.location.origin` — and there is no
//     `window` in node, so the origin resolves to "". A live session sends the
//     absolute URL. Set NEXT_PUBLIC_WEBHOOK_URL before running this if you want
//     the dump to show one.
//   - Nothing else in the payload reads env, so the rest is byte-for-byte what
//     the browser POSTs.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildVpsCustoms } from "../src/lib/voice/vpsCustoms";

const PLACEHOLDER_NAME = "{{trainee_name}}";

const payload = buildVpsCustoms(PLACEHOLDER_NAME);
const out = join(process.cwd(), "workflow-json", "vps.workflow.json");

writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`wrote ${out}`);
console.log(`  trainee name in prompt : ${PLACEHOLDER_NAME}`);
console.log(`  top-level keys         : ${Object.keys(payload).join(", ")}`);
