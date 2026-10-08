const ACTIVE_PROJECT_KEY = "seo-active-project";

export function preferredProject<T extends { id: string }>(projects: T[]): T | undefined {
  if (typeof window !== "undefined") {
    const id = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
    const selected = projects.find((project) => project.id === id);
    if (selected) return selected;
  }
  return projects[0];
}

export function rememberProject(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}
