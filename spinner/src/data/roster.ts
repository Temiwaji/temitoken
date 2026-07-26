import type { Student } from "../types";

export const TEACHER = { firstName: "Yewande", lastName: "Coker" };

// Edit this list to swap in real classmates - ids just need to stay unique and
// contiguous starting at 1, since the staking contract will use them as-is.
export const STUDENTS: Student[] = [
  { id: 1, firstName: "Chidinma", lastName: "Okafor" },
  { id: 2, firstName: "Tobiloba", lastName: "Adeyemi" },
  { id: 3, firstName: "Ngozi", lastName: "Eze" },
  { id: 4, firstName: "Ibrahim", lastName: "Suleiman" },
  { id: 5, firstName: "Folake", lastName: "Ogunleye" },
  { id: 6, firstName: "Emeka", lastName: "Nwachukwu" },
  { id: 7, firstName: "Aisha", lastName: "Bello" },
  { id: 8, firstName: "Damilola", lastName: "Afolabi" },
  { id: 9, firstName: "Chukwuemeka", lastName: "Obi" },
  { id: 10, firstName: "Zainab", lastName: "Mohammed" },
  { id: 11, firstName: "Oluwaseun", lastName: "Bakare" },
  { id: 12, firstName: "Adaeze", lastName: "Umeh" },
  { id: 13, firstName: "Yakubu", lastName: "Danjuma" },
  { id: 14, firstName: "Bisola", lastName: "Adekunle" },
];

export function fullName(s: Student): string {
  return `${s.firstName} ${s.lastName}`;
}

export function initials(s: Student): string {
  return `${s.firstName[0]}${s.lastName[0]}`.toUpperCase();
}
