import { cookies } from "next/headers";
import { LoginForm } from "./login-form";
import { t } from "@/lib/i18n/t";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/types";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const nextPath = next?.startsWith("/") ? next : "/fleet/dashboard";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex max-w-md flex-col gap-8 px-6 py-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">{t(locale, "auth.login.eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t(locale, "auth.login.title")}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {t(locale, "auth.login.description")} {t(locale, "auth.login.seedHint")}
          </p>
        </div>

        <LoginForm nextPath={nextPath} />
      </main>
    </div>
  );
}
