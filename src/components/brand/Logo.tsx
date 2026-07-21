import logoAsset from "@/assets/table-and-grace-logo.png.asset.json";

const sizeMap = {
  sm: "h-8",
  md: "h-12",
  lg: "h-20 sm:h-24",
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
      <img
        src={logoAsset.url}
        alt="Table and Grace"
        className={`${sizeMap[size]} w-auto`}
      />
    </div>
  );
}
