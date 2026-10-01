import { addDays } from "./renewals";

/** One all-day reminder. */
export interface CalendarEvent {
  /** Stable across downloads, so re-importing updates an event, not doubles it. */
  uid: string;
  /** YYYY-MM-DD. */
  date: string;
  summary: string;
  description: string;
}

/**
 * An iCalendar (.ics) file of all-day events, each with an alert at 9am that
 * day. The format every calendar app imports: Google, Apple, Outlook.
 *
 * The rules that trip up hand-written files (RFC 5545): lines end in CRLF;
 * a line longer than 75 octets is folded onto continuation lines starting
 * with a space; and commas, semicolons, backslashes and newlines in text are
 * escaped.
 */
export function icsCalendar(events: readonly CalendarEvent[], stamp: Date): string {
  const dtstamp = stamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StreamHopper//Renewal reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      // All-day events end the next day: DTEND is exclusive.
      `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      // Nine hours after the start of the day.
      "TRIGGER:PT9H",
      `DESCRIPTION:${escapeText(e.summary)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function compact(date: string): string {
  return date.replace(/-/g, "");
}

export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Splits a line into 75-octet pieces, never inside a character: an accent
 * or an emoji is several octets in UTF-8, and cutting one in half corrupts
 * it.
 */
export function fold(line: string): string {
  const pieces: string[] = [];
  let piece = "";
  let octets = 0;
  // Continuation lines start with a space, which counts toward their 75.
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      pieces.push(piece);
      piece = "";
      octets = 0;
      limit = 74;
    }
    piece += char;
    octets += size;
  }
  pieces.push(piece);
  return pieces.join("\r\n ");
}
