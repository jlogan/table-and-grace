import logoAsset from "@/assets/table-and-grace-logo.png.asset.json";

export function Logo({
  size = "md",
  showTagline = true,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const heightClass =
    size === "sm" ? "h-8" : size === "lg" ? "h-24 sm:h-28" : "h-14";

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
        className={`${heightClass} w-auto`}
      />
    </div>
  );
}
