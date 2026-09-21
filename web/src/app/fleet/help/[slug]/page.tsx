import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { getHelpArticle } from "@/lib/help-articles";
import { getAuthMeResult, canManageFleet } from "@/lib/auth-server";

type Props = { params: Promise<{ slug: string }> };

export default async function FleetHelpArticlePage({ params }: Props) {
  const auth = await getAuthMeResult();
  if (!auth.ok || !canManageFleet(auth)) {
    redirect("/fleet/dashboard");
  }

  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  return (
    <FleetPageMain narrow="md">
      <div>
        <Link href="/fleet/help" className="text-xs font-medium text-sky-400 hover:underline">
          ← Help
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{article.title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{article.summary}</p>
      </div>

      <div className="space-y-6">
        {article.sections.map((sec) => (
          <section key={sec.heading} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {sec.heading}
            </h2>
            <ul className="mt-3 space-y-2">
              {sec.body.map((line) => (
                <li key={line.slice(0, 48)} className="text-sm leading-relaxed text-zinc-300">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {article.relatedHrefs && article.relatedHrefs.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Legături</p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {article.relatedHrefs.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-sm text-emerald-400 hover:underline">
                  {r.label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FleetPageMain>
  );
}
