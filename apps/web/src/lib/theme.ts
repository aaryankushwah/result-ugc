export type Theme = "light" | "dark";

export function nextTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function themeFromCookie(cookie: string): Theme | null {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("result-theme="))?.split("=")[1] ?? null;
  return isTheme(value) ? value : null;
}

export function themeCookie(theme: Theme): string {
  return `result-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}
