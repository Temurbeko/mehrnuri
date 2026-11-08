import Link from "next/link";
import { BRAND } from "@/config/brand";
import { DEFAULT_LOCALE } from "@/i18n/config";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">{BRAND.logo}</div>
      <h1 className="text-2xl font-extrabold">404</h1>
      <Link href={`/${DEFAULT_LOCALE}`} className="btn-primary">
        {BRAND.name}
      </Link>
    </main>
  );
}
