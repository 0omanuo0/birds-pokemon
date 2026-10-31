// The pixel font has no accented letters, so names are shown (and matched) without them.
export const stripAccents = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Accent- and case-insensitive key, for search.
export const foldKey = (text: string | undefined) => stripAccents(text ?? "").toLowerCase();
