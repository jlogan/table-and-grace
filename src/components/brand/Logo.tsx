export function Logo({
  size = "md",
  showTagline = true,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const sizes = {
    sm: {
      tagline: "text-[0.55rem] mb-1",
      name: "text-xl",
      and: "text-[0.5rem] my-0.5",
      ring: "px-3 py-1.5",
    },
    md: {
      tagline: "text-[0.65rem] mb-2",
      name: "text-3xl",
      and: "text-[0.6rem] my-0.5",
      ring: "px-4 py-2",
    },
    lg: {
      tagline: "text-[0.65rem] mb-2",
      name: "text-5xl sm:text-6xl",
      and: "text-xs my-1",
      ring: "px-5 py-3",
    },
  } as const;

  const s = sizes[size];

  return (
    <div className="flex flex-col items-center leading-none">
      {showTagline && (
        <span className={`${s.tagline} font-semibold tracking-[0.2em] text-gold uppercase`}>
          Chef Margaux presents
        </span>
      )}
      <div
        className={`rounded-full border-2 border-gold bg-card ${s.ring} text-center`}
        aria-label="Table and Grace"
      >
        <span className={`font-display font-semibold text-navy ${s.name} tracking-tight block`}>
          Table
        </span>
        <span
          className={`font-display italic text-gold ${s.and} tracking-[0.35em] uppercase block`}
        >
          and
        </span>
        <span className={`font-display font-semibold text-navy ${s.name} tracking-tight block`}>
          Grace
        </span>
      </div>
    </div>
  );
}
