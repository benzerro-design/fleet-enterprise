import Link from "next/link";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/fleet/dashboard";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex max-w-md flex-col gap-8 px-6 py-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet enterprise</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Autentificare</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Autentificare cu utilizator din Postgres. JWT-ul (httpOnly) conține tenantul și rolul. După{" "}
            <code className="text-zinc-300">npm run db:seed</code>: admin{" "}
            <code className="text-zinc-300">admin@demo.local</code> sau{" "}
            <code className="text-zinc-300">viewer@demo.local</code> (doar citire flotă), parolă{" "}
            <code className="text-zinc-300">demo12345</code>, tenant <code className="text-zinc-300">demo</code>. După
            update la cod, rulează din nou <code className="text-zinc-300">npm run db:seed</code> în <code className="text-zinc-300">api/</code> dacă viewer nu se conectează.
          </p>
        </div>

        <LoginForm nextPath={nextPath} />

        <p className="text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            Înapoi la start
          </Link>
        </p>
      </main>
    </div>
  );
}
