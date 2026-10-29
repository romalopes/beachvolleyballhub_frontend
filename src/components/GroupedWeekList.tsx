import type { ReactNode } from "react";

interface WeekGroup {
  key: string;
  label: string;
}

interface GroupedWeekListProps<Item, Group extends WeekGroup> {
  groups: readonly Group[];
  variant: "training" | "tournament";
  getItems: (group: Group) => readonly Item[];
  renderItem: (item: Item) => ReactNode;
}

/** Shared Monday–Sunday section layout for training and tournament list views. */
export default function GroupedWeekList<Item, Group extends WeekGroup>({
  groups,
  variant,
  getItems,
  renderItem,
}: GroupedWeekListProps<Item, Group>) {
  return (
    <div className={`${variant}-weeks`}>
      {groups.map((group) => (
        <section
          key={group.key}
          className={`${variant}-week`}
          aria-label={group.label}
        >
          <h3 className={`${variant}-week-heading`}>{group.label}</h3>
          <div className={`${variant}-cards-grid`}>
            {getItems(group).map(renderItem)}
          </div>
        </section>
      ))}
    </div>
  );
}