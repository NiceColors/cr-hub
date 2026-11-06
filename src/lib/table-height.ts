/**
 * Viewport height for the virtualized beUI Table, which needs a fixed height:
 * shrinks to fit short lists and caps long ones so they scroll inside the table.
 * The header row is as tall as a body row, plus the 1px border that
 * `border-collapse` keeps outside that height. Leaving it out makes the
 * scroller overflow by a pixel and show a vertical scrollbar.
 */
export function fitTableHeight(
  rowCount: number,
  rowHeight: number,
  { minRows = 3, maxRows = 12 }: { minRows?: number; maxRows?: number } = {},
) {
  const rows = Math.min(Math.max(rowCount, minRows), maxRows);
  return rowHeight * (rows + 1) + 1;
}
