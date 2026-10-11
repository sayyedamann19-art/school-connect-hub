import * as a from "./parts/a";
import * as b from "./parts/b";
import * as c from "./parts/c";

export const mr: Record<string, string> = {
  ...a.mr,
  ...b.mr,
  ...c.mr,
  "Good morning": "सुप्रभात",
  "Good afternoon": "नमस्कार",
  "Good evening": "शुभ संध्याकाळ",
  "Good night": "शुभ रात्री",
  Home: "मुख्यपृष्ठ",
  Account: "खाते",
  Language: "भाषा",
};
