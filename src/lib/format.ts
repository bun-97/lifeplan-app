/** カンマ区切り数値（0 → "0"） */
export function fmt(n: number): string {
  return n.toLocaleString('ja-JP');
}

/** カンマ区切り数値（0 → "-"） */
export function fmtOrDash(n: number): string {
  return n === 0 ? '-' : n.toLocaleString('ja-JP');
}
