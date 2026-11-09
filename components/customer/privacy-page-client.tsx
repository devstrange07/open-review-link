"use client";

import Link from "next/link";
import { getPrivacyCopy } from "@/lib/i18n/privacy";
import { LanguageSwitcher } from "./language-switcher";
import { LocaleProvider, useLocale } from "./locale-provider";

type Props = {
  shopName: string;
  version: string;
  slug: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
};

export function PrivacyPageClient(props: Props) {
  return (
    <LocaleProvider>
      <PrivacyPageInner {...props} />
    </LocaleProvider>
  );
}

function PrivacyPageInner({
  shopName,
  version,
  slug,
  contactEmail,
  contactAddress,
}: Props) {
  const { locale } = useLocale();
  const copy = getPrivacyCopy(locale);

  return (
    <div className="min-h-screen-safe">
      <main
        id="main"
        className="pb-safe-lg mx-auto w-full max-w-xl px-5 pt-6 text-[0.9375rem] leading-relaxed"
      >
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          {copy.versionLine(version, shopName)}
        </p>

        <div className="mt-7 space-y-6 text-pretty">
          {copy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              {Array.isArray(section.body) ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[color:var(--text-muted)]">
                  {section.body.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[color:var(--text-muted)]">{section.body}</p>
              )}
            </section>
          ))}

          <section>
            <h2 className="text-base font-semibold">
              {locale === "hi" ? "संपर्क" : locale === "gu" ? "સંપર્ક" : "Contact"}
            </h2>
            {contactEmail ? (
              <p className="mt-1.5 text-[color:var(--text-muted)]">
                {copy.contactIntro}{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="pressable font-medium text-[color:var(--brand-ink)] underline underline-offset-2"
                >
                  {contactEmail}
                </a>
                {contactAddress ? (
                  <>
                    <br />
                    <span className="whitespace-pre-line">{contactAddress}</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-1.5 text-[color:var(--text-muted)]">{copy.contactMissing}</p>
            )}
          </section>
        </div>

        <div className="mt-8 border-t border-[color:var(--border)] pt-5">
          <Link
            href={slug ? `/r/${slug}` : "/"}
            className="pressable text-sm font-medium text-[color:var(--brand-ink)] underline-offset-4 hover:underline"
          >
            {copy.backLink}
          </Link>
        </div>
      </main>
    </div>
  );
}
