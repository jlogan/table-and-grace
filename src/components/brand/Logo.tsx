export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = size === "sm" ? "text-xl" : size === "lg" ? "text-5xl" : "text-3xl";
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-gold uppercase">
        Chef Margaux presents
      </span>
      <span className={`font-display italic font-semibold text-navy ${scale}`}>
        table <span className="text-gold not-italic text-[0.55em] align-middle mx-0.5">✤</span>
        <span className="not-italic text-[0.5em] align-middle tracking-widest">AND</span>
        <span className="text-gold not-italic text-[0.55em] align-middle mx-0.5">✤</span> grace
      </span>
    </div>
  );
}
