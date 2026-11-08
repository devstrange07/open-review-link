/**
 * Privacy disclosure.
 *
 * Replaces the old consent checkbox. Sharing the written feedback is implicit
 * in using the flow, so there is nothing to tick — but the customer still
 * deserves to see, in plain words, where their words go. Quiet, non-interactive
 * copy with a link to the full notice: it informs without adding a step.
 *
 * Server-rendered, no state: the number of taps to send a review is the whole
 * point of removing the checkbox, and a client component here would put it back.
 */

type Props = {
  shopName: string;
};

export function PrivacyDisclosure({ shopName }: Props) {
  return (
    <p className="text-[0.8125rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
      Your feedback is shared privately with {shopName} to help improve the service. It is
      never published publicly.{" "}
      <a
        href="/privacy"
        className="font-medium underline underline-offset-2 hover:text-[color:var(--text)]"
      >
        Privacy notice
      </a>
    </p>
  );
}
