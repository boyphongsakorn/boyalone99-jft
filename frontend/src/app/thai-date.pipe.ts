import { Pipe, PipeTransform } from '@angular/core';

/**
 * Format a MySQL timestamp / ISO string as Thai-friendly DD/MM/YYYY HH:MM.
 * MySQL DATETIME ("2026-10-27 13:05:00") is treated as UTC so it renders in
 * the viewer's local time. Strings with no timezone info are assumed UTC.
 */
@Pipe({
  name: 'thaiDate',
  standalone: true,
})
export class ThaiDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '-';

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else {
      const raw = String(value).trim();
      if (!raw) return '-';
      // "YYYY-MM-DD HH:MM:SS" (MySQL) → ISO with explicit UTC marker
      const mysql = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
      date = mysql
        ? new Date(Date.UTC(+mysql[1], +mysql[2] - 1, +mysql[3], +mysql[4], +mysql[5], +(mysql[6] || 0)))
        : new Date(raw);
    }

    if (Number.isNaN(date.getTime())) return String(value);

    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${p2(date.getDate())}/${p2(date.getMonth() + 1)}/${date.getFullYear()} ${p2(date.getHours())}:${p2(date.getMinutes())}`;
  }
}
