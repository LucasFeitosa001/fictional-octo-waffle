/* eslint-disable @next/next/no-img-element */

/** Salonpass mark (S-in-hexagon badge). White variant from /public. */
export function SalonpassMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/salonpass-mark.svg"
      alt="Salonpass"
      width={size}
      height={Math.round((size * 1024) / 1070)}
      className={className}
    />
  );
}
