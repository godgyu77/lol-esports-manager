/** 템플릿 문자열의 {key} 플레이스홀더를 vars 값으로 치환 */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), text);
}
