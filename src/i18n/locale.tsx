import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import spanish from "./es.json";
export type Locale = "en" | "es";
let locale: Locale = "en";
const listeners = new Set<() => void>();
type Translator = (message: string | null | undefined) => string;
export function setApplicationLocale(value: Locale): void {
  locale = value;
  document.documentElement.lang = value;
  for (const listener of listeners) listener();
}
export const applicationLocale = (): Locale => locale;
const dictionary: Readonly<Record<string, string>> = spanish;

/** English source keys keep UI copy readable; personal project names, filenames and caption text stay data. */
export function translateMessage(
  message: string | null | undefined,
  language: Locale = locale,
): string {
  if (!message || language === "en") return message ?? "";
  const key = message.trim();
  const translated = dictionary[key];
  if (translated) return message.replace(key, translated);
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [
      /^Sound (\d+) (.+)$/,
      (match) => `Sonido ${match[1]} ${dictionary[match[2]] ?? match[2]}`,
    ],
    [/^Scene (\d+): (.+)$/, (match) => `Escena ${match[1]}: ${match[2]}`],
    [/^Open (.+)$/, (match) => `Abrir ${match[1]}`],
    [/^Manage (.+)$/, (match) => `Gestionar ${match[1]}`],
    [/^Rename (.+)$/, (match) => `Renombrar ${match[1]}`],
    [/^Add (.+)$/, (match) => `Añadir ${match[1]}`],
    [/^Preview (.+)$/, (match) => `Vista previa de ${match[1]}`],
    [/^Use (.+)$/, (match) => `Usar ${match[1]}`],
    [
      /^Cancel queued export (.+)$/,
      (match) => `Cancelar exportación de ${match[1]}`,
    ],
    [
      /^Recover previous edit of (.+)$/,
      (match) => `Recuperar la edición anterior de ${match[1]}`,
    ],
    [/^Delete marker (.+)$/, (match) => `Eliminar marcador ${match[1]}`],
  ];
  for (const [pattern, render] of patterns) {
    const match = message.match(pattern);
    if (match) return render(match);
  }
  return message;
}
const Context = createContext<Translator>(translateMessage);
export const useT = (): Translator => useContext(Context);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, applicationLocale);
  const translate = useMemo<Translator>(
    () => (message) => translateMessage(message, language),
    [language],
  );
  return <Context.Provider value={translate}>{children}</Context.Provider>;
}
