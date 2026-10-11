/** Greeting by local hour: 5–11 morning, 12–16 afternoon, 17–20 evening, else night. Returns the English key; translate with t(). */
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}
