import en from "../../messages/en.json";
import am from "../../messages/am.json";

const translations: Record<string, any> = { en, am };

/**
 * Get a translated string for a given key and locale.
 * Supports ICU-style placeholders like {name}.
 * 
 * Fallback strategy: 
 * 1. Targeted locale + key
 * 2. English + key (if target locale doesn't have it)
 * 3. Raw key (if both fail)
 */
export function getTranslation(
  keyPath: string,
  locale: string = "en",
  values: Record<string, string | number> = {}
): string {
  const targetLocale = translations[locale] ? locale : "en";
  
  let text = getNestedValue(translations[targetLocale], keyPath);
  
  // Fallback to English if key missing in target locale
  if (!text && targetLocale !== "en") {
    text = getNestedValue(translations["en"], keyPath);
  }

  // Final fallback to raw key
  if (!text) return keyPath;

  // Simple interpolation
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{${key}}`, "g"), String(value));
  }, text);
}

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, part) => (acc && acc[part] ? acc[part] : undefined), obj);
}
