export type Subject = { name: string; percentage: number };

// Standard South African APS: 7 subjects, exclude Life Orientation from top count.
export function apsPointsFor(percentage: number): number {
  if (percentage >= 80) return 7;
  if (percentage >= 70) return 6;
  if (percentage >= 60) return 5;
  if (percentage >= 50) return 4;
  if (percentage >= 40) return 3;
  if (percentage >= 30) return 2;
  return 1;
}

export function calculateAPS(subjects: Subject[]): number {
  const scored = subjects
    .filter((s) => s.name && !/life\s*orientation/i.test(s.name))
    .map((s) => apsPointsFor(s.percentage));
  // Take best 6 non-LO subjects
  scored.sort((a, b) => b - a);
  return scored.slice(0, 6).reduce((sum, p) => sum + p, 0);
}

export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

export const STUDY_FIELDS = [
  "Engineering",
  "Computer Science / IT",
  "Business / Commerce",
  "Health Sciences",
  "Education",
  "Law",
  "Humanities",
  "Natural Sciences",
  "Agriculture",
  "Arts & Design",
  "Trades (TVET)",
];
