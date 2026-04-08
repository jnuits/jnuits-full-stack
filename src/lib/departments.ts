export type DepartmentOption = {
  code: string;
  name: string;
};

export const departments: DepartmentOption[] = [
  { code: "accounting-information-system", name: "Accounting & Information System" },
  { code: "anthropology", name: "Anthropology" },
  { code: "bangla", name: "Bangla" },
  { code: "biochemistry-molecular-biology", name: "Biochemistry & Molecular Biology" },
  { code: "botany", name: "Botany" },
  { code: "chemistry", name: "Chemistry" },
  { code: "computer-science-engineering", name: "Computer Science & Engineering" },
  { code: "economics", name: "Economics" },
  { code: "english", name: "English" },
  { code: "film-television", name: "Film & Television" },
  { code: "finance", name: "Finance" },
  { code: "fine-arts", name: "Fine Arts" },
  { code: "genetic-engineering-biotechnology", name: "Genetic Engineering & Biotechnology" },
  { code: "geography-environment", name: "Geography & Environment" },
  { code: "history", name: "History" },
  { code: "institute-of-education-and-research", name: "Institute of Education & Research" },
  { code: "institute-of-modern-languages", name: "Institute of Modern Languages" },
  { code: "islamic-history-culture", name: "Islamic History & Culture" },
  { code: "islamic-studies", name: "Islamic Studies" },
  { code: "land-management-law", name: "Land Management & Law" },
  { code: "law", name: "Law" },
  { code: "management-studies", name: "Management Studies" },
  { code: "marketing", name: "Marketing" },
  { code: "mass-communication-journalism", name: "Mass Communication & Journalism" },
  { code: "mathematics", name: "Mathematics" },
  { code: "microbiology", name: "Microbiology" },
  { code: "music", name: "Music" },
  { code: "pharmacy", name: "Pharmacy" },
  { code: "philosophy", name: "Philosophy" },
  { code: "physics", name: "Physics" },
  { code: "political-science", name: "Political Science" },
  { code: "psychology", name: "Psychology" },
  { code: "public-administration", name: "Public Administration" },
  { code: "social-work", name: "Social Work" },
  { code: "sociology", name: "Sociology" },
  { code: "statistics", name: "Statistics" },
  { code: "theatre", name: "Theatre" },
  { code: "zoology", name: "Zoology" },
];

export function findDepartmentByCode(code: string) {
  return departments.find((department) => department.code === code) || null;
}
