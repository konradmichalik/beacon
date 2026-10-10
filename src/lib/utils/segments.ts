/** A segmented-control option whose label is also its accessible name. */
export const seg = <T extends string>(value: T, label: string) => ({
  value,
  aria: label,
  label
});
