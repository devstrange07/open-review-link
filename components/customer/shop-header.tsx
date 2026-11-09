import type { BusinessSettings } from "@/lib/settings";
import { Star } from "lucide-react";

/**
 * Shop identity block. Server component — no interactivity, so no JS shipped.
 *
 * The logo is a plain <img> with explicit dimensions and fixed layout box so a
 * slow or broken logo URL cannot reflow the page or shift the stars under the
 * customer's thumb.
 *
 * On later steps the header shrinks (`compact`) and can show the selected
 * rating as a quiet status so the customer never needs a separate "you rated
 * us" reminder under the fold.
 */

type Props = {
  shop: Pick<BusinessSettings, "name" | "logoUrl">;
  size?: "default" | "compact";
  /** When set, render a non-interactive star summary under the shop name. */
  rating?: number | null;
};

export function ShopHeader({ shop, size = "default", rating = null }: Props) {
  const logoSize = size === "compact" ? 40 : 56;
  const compact = size === "compact";

  return (
    <header
      className={`shop-header flex flex-col items-center text-center ${
        compact ? "shop-header--compact gap-2" : "gap-3"
      }`}
      data-size={size}
    >
      {shop.logoUrl ? (
        // The logo URL is an arbitrary operator-supplied value from the DB, so
        // next/image can't be used without an allowlisted remote host pattern —
        // and `unoptimized` would just re-implement this tag. It renders at
        // 56px with explicit dimensions, decoding off the critical path.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shop.logoUrl}
          alt=""
          width={logoSize}
          height={logoSize}
          // Decorative: the shop name sits right below and is the real label.
          aria-hidden="true"
          className="shop-header__logo rounded-2xl object-contain"
          style={{ width: logoSize, height: logoSize }}
          decoding="async"
        />
      ) : (
        <div
          aria-hidden="true"
          className="shop-header__logo grid place-items-center rounded-2xl text-[color:var(--brand-ink)]"
          style={{
            width: logoSize,
            height: logoSize,
            backgroundColor: "var(--brand-soft)",
          }}
        >
          <Star className={compact ? "size-5" : "size-6"} strokeWidth={2} />
        </div>
      )}
      <p
        className={`max-w-full font-medium tracking-tight text-pretty break-words text-[color:var(--text-muted)] ${
          compact ? "text-[0.8125rem]" : "text-[0.9375rem]"
        }`}
      >
        {shop.name}
      </p>
      {rating !== null ? (
        <div
          className="shop-header__rating flex gap-0.5"
          aria-label={rating === 1 ? "1 star selected" : `${rating} stars selected`}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              aria-hidden="true"
              className="text-sm leading-none"
              style={{
                color: star <= rating ? "var(--brand)" : "var(--border)",
              }}
            >
              ★
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
