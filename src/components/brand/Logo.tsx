const sizeMap = {
  sm: "text-xl sm:text-2xl",
  md: "text-3xl",
  lg: "text-5xl sm:text-6xl",
} as const;

export function Logo({
  size = "md",
  showTagline = false,
}: {
  size?: keyof typeof sizeMap;
  showTagline?: boolean;
}) {
  return (
    <div className="flex flex-col items-center leading-none">
      {showTagline && (
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-gold uppercase mb-2">
          Chef Margaux presents
        </span>
      )}
      <p className={`font-display font-semibold tracking-tight text-navy ${sizeMap[size]}`}>
        Table <span className="text-gold italic font-normal">and</span> Grace
      </p>
    </div>
  );
}
