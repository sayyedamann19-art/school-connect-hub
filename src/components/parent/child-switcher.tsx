import { StudentAvatar } from "@/components/common/student-card";
import { cn } from "@/lib/utils";

export type SwitchableChild = {
  id: string;
  full_name: string;
  photoUrl?: string | null;
};

/** Sibling switcher: a single parent account can hold several children. */
export function ChildSwitcher({
  childrenList,
  activeId,
  onSelect,
}: {
  childrenList: SwitchableChild[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (childrenList.length < 2) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {childrenList.map((child) => {
        const active = child.id === activeId;
        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelect(child.id)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-primary/20 bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            <StudentAvatar
              name={child.full_name}
              src={child.photoUrl ?? null}
              tone="teal"
              className="size-7 border-0"
            />
            {child.full_name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
