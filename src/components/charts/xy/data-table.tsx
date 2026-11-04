import type { XYRow } from "./model";

/** Every value stays readable by screen readers without a tab stop per mark. */
export function XYDataTable({
  label,
  rows,
  categories,
  formatValue,
}: {
  label: string;
  rows: readonly XYRow[];
  categories: readonly string[];
  formatValue: (value: number) => string;
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {rows.map((row) => (
              <th key={row.id} scope="col">
                {row.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category, i) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {rows.map((row) => {
                const value = row.values[i];
                return <td key={row.id}>{value === null ? "Sem dados" : formatValue(value)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
