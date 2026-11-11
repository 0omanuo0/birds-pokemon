// "14 MAR 2026" layout, with the month name from the browser's preferred language.
// Pieces are formatted separately so the order is fixed (en-US would give "Mar 14, 2026")
// and the month stays a name (pt-PT turns it into "03" when day+year are in the same pattern).
// Formatters are built once: constructing an Intl.DateTimeFormat is slow, and this runs on every render of the
// dex head card and the profile (created lazily, so the browser's language is the one used, not the server's).
let seenDateFormat: { day: Intl.DateTimeFormat; month: Intl.DateTimeFormat; year: Intl.DateTimeFormat } | null = null;

export function formatSeenDate(unixSeconds: number) {
    const date = new Date(unixSeconds * 1000);
    seenDateFormat ??= {
        day: new Intl.DateTimeFormat(undefined, { day: "numeric" }),
        month: new Intl.DateTimeFormat(undefined, { month: "short" }),
        year: new Intl.DateTimeFormat(undefined, { year: "numeric" }),
    };
    // some locales abbreviate with a trailing dot ("mar.", "févr.")
    const month = seenDateFormat.month.format(date).replace(/\./g, "");
    return `${seenDateFormat.day.format(date)} ${month} ${seenDateFormat.year.format(date)}`.toUpperCase();
}

// "14 MAR 2026 · 18:42" in the viewer's locale and timezone
export const formatStamp = (seenAt: number) =>
    `${formatSeenDate(seenAt)} · ${new Date(seenAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
