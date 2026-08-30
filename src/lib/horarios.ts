export type HoursRow = {
  id: string;
  staff_id: string | null;
  day_of_week: number;
  opens: string;
  closes: string;
  active: boolean;
};

export function buildHoursByDay(rows: HoursRow[]) {
  const byDay: Record<number, HoursRow[]> = {};
  for (const row of rows) {
    if (!byDay[row.day_of_week]) byDay[row.day_of_week] = [];
    byDay[row.day_of_week].push(row);
  }
  return byDay;
}