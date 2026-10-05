/**
 * "3 towers" / "1 tower" — pairs a count with the right singular/plural noun.
 *
 * Why a helper: when the UI was translated to English, `{n} towers` was written in
 * 13 places, and the Golden Goose district (one tower) showed "1 towers".
 * Thai has no plural forms, so this bug couldn't exist before the translation —
 * then it appeared everywhere at once. Keeping it in one place avoids that.
 *
 * Fractional shares (0.316) are correctly plural, since the check is !== 1.
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Like plural, but the caller supplies the count text (e.g. an already-formatted number) */
export function pluralize(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
