export function moveItem<T>(items: readonly T[], item: T, target: T): T[] {
  const from = items.indexOf(item);
  const to = items.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...items];

  const next = [...items];
  next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
