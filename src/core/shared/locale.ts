export const supportedLocales = ["en", "pl", "zh-CN", "ar", "ru"] as const;
export type Locale = (typeof supportedLocales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && supportedLocales.includes(value as Locale);

export const textDirection = (locale: Locale): "ltr" | "rtl" => locale === "ar" ? "rtl" : "ltr";

