/**
 * Privacy disclosure.
 *
 * Sharing private feedback is the customer's decision when they continue the
 * flow. This quiet line links to the full notice without a checkbox.
 */

type Props = {
  shopName: string;
  label: string;
};

export function PrivacyDisclosure({ shopName, label }: Props) {
  // shopName kept for callers that compose the short line themselves; label is
  // the fully translated string (e.g. "Private to X · Privacy notice").
  void shopName;
  // Prefer splitting so only "Privacy notice" is the link when label contains ·
  const parts = label.split("·");
  const before = parts[0]?.trim() ?? label;
  const linkText = parts[1]?.trim() ?? label;

  return (
    <p className="text-center text-xs leading-relaxed text-pretty text-[color:var(--text-muted)]">
      {parts.length > 1 ? (
        <>
          {before}
          {" · "}
          <a
            href="/privacy"
            className="pressable font-medium underline underline-offset-2 hover:text-[color:var(--text)]"
          >
            {linkText}
          </a>
        </>
      ) : (
        <a
          href="/privacy"
          className="pressable font-medium underline underline-offset-2 hover:text-[color:var(--text)]"
        >
          {label}
        </a>
      )}
    </p>
  );
}
