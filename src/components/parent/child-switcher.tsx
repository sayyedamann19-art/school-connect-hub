import { StudentAvatar } from "@/components/common/student-card";
import { children, type MockChild } from "@/lib/mock/school-data";
import { cn } from "@/lib/utils";

/** Sibling switcher: a single parent account can hold several children. */
export function ChildSwitcher({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (children.length < 2) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {children.map((child) => {
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
              name={child.name}
              tone={child.photoTone}
              className="size-7 border-0"
            />
            {child.name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}

export function useActiveChild(activeId: string): MockChild {
  return children.find((child) => child.id === activeId) ?? children[0]!;
}
