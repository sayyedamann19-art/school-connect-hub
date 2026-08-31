/**
 * UI-only mock data for the Dawn Breakers School V1 presentation build.
 *
 * These records exist purely so the parent and teacher screens can be reviewed
 * with realistic content. No backend calls, no writes — swap each export for a
 * server function / query when the corresponding module is wired up.
 */

export type AttendanceState = "present" | "absent" | "late" | "left_early";

export type MockChild = {
  id: string;
  name: string;
  className: string;
  division: string;
  rollNumber: string;
  grNumber: string;
  dateOfBirth: string;
  attendancePercent: number;
  characterScore: number;
  photoTone: "teal" | "gold" | "info";
};

export const parentName = "Farah Sayyed";

export const children: MockChild[] = [
  {
    id: "aarav",
    name: "Aarav Sharma",
    className: "VIII",
    division: "A",
    rollNumber: "14",
    grNumber: "202600145",
    dateOfBirth: "12 March 2012",
    attendancePercent: 92,
    characterScore: 85,
    photoTone: "teal",
  },
  {
    id: "ishani",
    name: "Ishani Sharma",
    className: "V",
    division: "B",
    rollNumber: "07",
    grNumber: "202600311",
    dateOfBirth: "28 August 2015",
    attendancePercent: 96,
    characterScore: 72,
    photoTone: "gold",
  },
];

export type AttendanceSummary = {
  percent: number;
  verdict: string;
  present: number;
  absent: number;
  late: number;
  leftEarly: number;
  month: string;
  days: { day: number; state: AttendanceState | null }[];
  trend: { label: string; value: number }[];
  monthly: { month: string; percent: number }[];
};

const septemberDays: { day: number; state: AttendanceState | null }[] = Array.from(
  { length: 30 },
  (_, index) => {
    const day = index + 1;
    const weekday = new Date(2026, 8, day).getDay();
    if (weekday === 0) return { day, state: null };
    if (day === 9) return { day, state: "absent" as AttendanceState };
    if (day === 4 || day === 17) return { day, state: "late" as AttendanceState };
    if (day > 21) return { day, state: null };
    return { day, state: "present" as AttendanceState };
  },
);

export const attendanceByChild: Record<string, AttendanceSummary> = {
  aarav: {
    percent: 92,
    verdict: "Excellent attendance",
    present: 18,
    absent: 1,
    late: 2,
    leftEarly: 0,
    month: "September 2026",
    days: septemberDays,
    trend: [
      { label: "Apr", value: 90 },
      { label: "May", value: 93 },
      { label: "Jun", value: 88 },
      { label: "Jul", value: 89 },
      { label: "Aug", value: 95 },
      { label: "Sep", value: 92 },
    ],
    monthly: [
      { month: "September", percent: 92 },
      { month: "August", percent: 95 },
      { month: "July", percent: 89 },
    ],
  },
  ishani: {
    percent: 96,
    verdict: "Outstanding attendance",
    present: 20,
    absent: 0,
    late: 1,
    leftEarly: 1,
    month: "September 2026",
    days: septemberDays.map((entry) =>
      entry.day === 9 ? { day: 9, state: "present" as AttendanceState } : entry,
    ),
    trend: [
      { label: "Apr", value: 94 },
      { label: "May", value: 96 },
      { label: "Jun", value: 92 },
      { label: "Jul", value: 95 },
      { label: "Aug", value: 97 },
      { label: "Sep", value: 96 },
    ],
    monthly: [
      { month: "September", percent: 96 },
      { month: "August", percent: 97 },
      { month: "July", percent: 95 },
    ],
  },
};

export type Feedback = {
  id: string;
  childId: string;
  teacher: string;
  subject: string;
  date: string;
  tone: "positive" | "neutral" | "concern";
  message: string;
};

export const feedback: Feedback[] = [
  {
    id: "f1",
    childId: "aarav",
    teacher: "Mrs. Rehana Qureshi",
    subject: "Science · VIII-A",
    date: "2 September 2026",
    tone: "positive",
    message: "Excellent participation during today's class discussion on renewable energy.",
  },
  {
    id: "f2",
    childId: "aarav",
    teacher: "Mr. Imran Shaikh",
    subject: "Mathematics · VIII-A",
    date: "29 August 2026",
    tone: "neutral",
    message: "Improving steadily on algebra. A little more practice with word problems will help.",
  },
  {
    id: "f3",
    childId: "ishani",
    teacher: "Ms. Neha Kulkarni",
    subject: "English · V-B",
    date: "28 August 2026",
    tone: "positive",
    message: "Read aloud with wonderful expression and helped a classmate with pronunciation.",
  },
  {
    id: "f4",
    childId: "aarav",
    teacher: "Mrs. Anita Deshpande",
    subject: "Social Studies · VIII-A",
    date: "24 August 2026",
    tone: "concern",
    message: "Homework was submitted two days late. Please encourage a fixed evening study slot.",
  },
];

export type CharacterTrait = {
  name: string;
  score: number;
  max: number;
};

export type CharacterEntry = {
  id: string;
  date: string;
  points: number;
  trait: string;
  teacher: string;
  reason: string;
};

export type CharacterCard = {
  score: number;
  positive: number;
  negative: number;
  traits: CharacterTrait[];
  history: CharacterEntry[];
};

export const characterByChild: Record<string, CharacterCard> = {
  aarav: {
    score: 85,
    positive: 94,
    negative: 9,
    traits: [
      { name: "Respect", score: 18, max: 20 },
      { name: "Responsibility", score: 15, max: 20 },
      { name: "Honesty", score: 17, max: 20 },
      { name: "Discipline", score: 13, max: 20 },
      { name: "Kindness", score: 16, max: 20 },
      { name: "Cooperation", score: 15, max: 20 },
    ],
    history: [
      {
        id: "c1",
        date: "2 September 2026",
        points: 5,
        trait: "Cooperation",
        teacher: "Mrs. Rehana Qureshi",
        reason: "Led the lab group patiently and cleaned up without being asked.",
      },
      {
        id: "c2",
        date: "30 August 2026",
        points: 4,
        trait: "Honesty",
        teacher: "Mr. Imran Shaikh",
        reason: "Returned a classmate's lost calculator to the staff room.",
      },
      {
        id: "c3",
        date: "27 August 2026",
        points: -3,
        trait: "Discipline",
        teacher: "Mrs. Anita Deshpande",
        reason: "Talking during the morning assembly reading.",
      },
      {
        id: "c4",
        date: "21 August 2026",
        points: 6,
        trait: "Kindness",
        teacher: "Ms. Neha Kulkarni",
        reason: "Helped a junior student find their classroom on the first day back.",
      },
    ],
  },
  ishani: {
    score: 72,
    positive: 78,
    negative: 6,
    traits: [
      { name: "Respect", score: 16, max: 20 },
      { name: "Responsibility", score: 14, max: 20 },
      { name: "Honesty", score: 15, max: 20 },
      { name: "Discipline", score: 12, max: 20 },
      { name: "Kindness", score: 18, max: 20 },
      { name: "Cooperation", score: 14, max: 20 },
    ],
    history: [
      {
        id: "d1",
        date: "1 September 2026",
        points: 5,
        trait: "Kindness",
        teacher: "Ms. Neha Kulkarni",
        reason: "Shared her lunch with a classmate who forgot her tiffin.",
      },
      {
        id: "d2",
        date: "26 August 2026",
        points: 3,
        trait: "Respect",
        teacher: "Mrs. Rehana Qureshi",
        reason: "Greeted visiting parents politely during the open day.",
      },
    ],
  },
};

export type UpdateCategory = "school" | "attendance" | "feedback" | "notice";

export type SchoolUpdate = {
  id: string;
  category: UpdateCategory;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

export const updates: SchoolUpdate[] = [
  {
    id: "u1",
    category: "notice",
    title: "Annual Day rehearsal schedule",
    body: "Rehearsals begin 7 September. Students in the choir stay back until 4:30 pm.",
    time: "Today · 9:10 am",
    unread: true,
  },
  {
    id: "u2",
    category: "attendance",
    title: "Aarav marked late on 17 September",
    body: "Arrived at 8:22 am. Two late marks recorded this month.",
    time: "Today · 8:30 am",
    unread: true,
  },
  {
    id: "u3",
    category: "feedback",
    title: "New feedback from Mrs. Rehana Qureshi",
    body: "Excellent participation during today's class discussion on renewable energy.",
    time: "Yesterday · 3:45 pm",
    unread: false,
  },
  {
    id: "u4",
    category: "school",
    title: "Parent–teacher meeting: 13 September",
    body: "Slots open from 9:00 am to 1:00 pm. Please carry the school diary.",
    time: "28 August · 11:00 am",
    unread: false,
  },
  {
    id: "u5",
    category: "school",
    title: "Founder's Day holiday",
    body: "The school remains closed on 20 September in observance of Founder's Day.",
    time: "24 August · 10:15 am",
    unread: false,
  },
];

export type ClassRosterStudent = {
  id: string;
  name: string;
  rollNumber: string;
};

export const teacherClass = {
  label: "VIII-A",
  subject: "Class teacher",
  date: "September 3, 2026",
  strength: 34,
};

export const roster: ClassRosterStudent[] = [
  { id: "s1", name: "Aarav Sharma", rollNumber: "14" },
  { id: "s2", name: "Aditi Kulkarni", rollNumber: "01" },
  { id: "s3", name: "Bilal Ahmed", rollNumber: "02" },
  { id: "s4", name: "Chirag Menon", rollNumber: "03" },
  { id: "s5", name: "Diya Patel", rollNumber: "04" },
  { id: "s6", name: "Farhan Sayyed", rollNumber: "05" },
  { id: "s7", name: "Gauri Naik", rollNumber: "06" },
  { id: "s8", name: "Hasan Khan", rollNumber: "07" },
  { id: "s9", name: "Isha Rane", rollNumber: "08" },
  { id: "s10", name: "Jay Thakur", rollNumber: "09" },
  { id: "s11", name: "Kavya Iyer", rollNumber: "10" },
  { id: "s12", name: "Lakshya Verma", rollNumber: "11" },
];

export function childById(id: string): MockChild | undefined {
  return children.find((child) => child.id === id);
}
