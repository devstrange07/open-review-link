import type { BusinessSettings } from "@/lib/settings";
import { Star } from "lucide-react";

/**
 * Shop identity block. Server component — no interactivity, so no JS shipped.
 *
 * The logo is a plain <img> with explicit dimensions and fixed layout box so a
 * slow or broken logo URL cannot reflow the page or shift the stars under the
 * customer's thumb.
 */

type Props = {
  shop: Pick<BusinessSettings, "name" | "logoUrl">;
  size?: "default" | "compact";
};

export function ShopHeader({ shop, size = "default" }: Props) {
  const logoSize = size === "compact" ? 40 : 56;

  return (
    <header className="flex flex-col items-center gap-3 text-center">
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
          className="rounded-2xl object-contain"
          style={{ width: logoSize, height: logoSize }}
          decoding="async"
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid place-items-center rounded-2xl text-[color:var(--brand-ink)]"
          style={{
            width: logoSize,
            height: logoSize,
            backgroundColor: "var(--brand-soft)",
          }}
        >
          <Star className="size-6" strokeWidth={2} />
        </div>
      )}
      <p className="text-[0.9375rem] font-medium tracking-tight text-[color:var(--text-muted)]">
        {shop.name}
      </p>
    </header>
  );
}
