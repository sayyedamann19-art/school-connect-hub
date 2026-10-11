/** Greeting by local hour: 5–11 morning, 12–16 afternoon, 17–20 evening, else night. */
export function greetingFor(t: (s: string) => string, date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return t("Good morning");
  if (h >= 12 && h < 17) return t("Good afternoon");
  if (h >= 17 && h < 21) return t("Good evening");
  return t("Good night");
}
