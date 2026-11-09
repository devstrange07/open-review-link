/**
 * Privacy disclosure.
 *
 * Replaces the old consent checkbox. Sharing the written feedback is implicit
 * in using the flow, so there is nothing to tick — but the customer still
 * deserves a quiet cue that their words stay with the shop. One short line
 * with a link to the full notice: informs without eating the fold.
 *
 * Server-rendered, no state: the number of taps to send a review is the whole
 * point of removing the checkbox, and a client component here would put it back.
 */

type Props = {
  shopName: string;
};

export function PrivacyDisclosure({ shopName }: Props) {
  return (
    <p className="text-center text-xs leading-relaxed text-pretty text-[color:var(--text-muted)]">
      Private to {shopName}
      {" · "}
      <a
        href="/privacy"
        className="font-medium underline underline-offset-2 hover:text-[color:var(--text)]"
      >
        Privacy notice
      </a>
    </p>
  );
}
