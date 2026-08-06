import Link from "next/link";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/auth/session";
import { requireAccessibleCompany } from "@/lib/practice/access";
import { getResumeChat } from "@/lib/practice/resumeChat";
import PracticeHeader from "@/components/practice/PracticeHeader";
import ResumeChatStart from "@/components/practice/ResumeChatStart";
import ResumeChatInterface from "@/components/practice/ResumeChatInterface";

export const dynamic = "force-dynamic";

export default async function ResumeChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice"], "/practice/login");

  const company = await requireAccessibleCompany(user.id, id);
  const chat = await getResumeChat(user.id, id);

  return (
    <main className="practice-page min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} tenant={user.tenant} />

      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-10">
        <Link
          href={`/practice/companies/${id}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← {company.companyName}
        </Link>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-ink">
            Resume &amp; career chat — {company.companyName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            One ongoing conversation for this company — ask anything, come
            back anytime.
          </p>
        </div>

        {chat ? (
          <ResumeChatInterface
            companyId={id}
            companyName={company.companyName}
            initialMessages={chat.messages as unknown as UIMessage[]}
          />
        ) : (
          <ResumeChatStart companyId={id} />
        )}
      </div>
    </main>
  );
}
