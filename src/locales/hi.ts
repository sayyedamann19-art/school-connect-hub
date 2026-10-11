import * as a from "./parts/a";
import * as b from "./parts/b";
import * as c from "./parts/c";

export const hi: Record<string, string> = {
  ...a.hi,
  ...b.hi,
  ...c.hi,
  "Good morning": "सुप्रभात",
  "Good afternoon": "नमस्कार",
  "Good evening": "शुभ संध्या",
  "Good night": "शुभ रात्रि",
  Home: "होम",
  Account: "खाता",
  Language: "भाषा",
};
