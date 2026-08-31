import { logoUrl, schoolName } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The school crest, used exactly as supplied — never recoloured or cropped. */
export function SchoolLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt={`${schoolName} crest`}
      className={cn("size-10 rounded-full object-cover", className)}
      loading="eager"
      decoding="async"
    />
  );
}
