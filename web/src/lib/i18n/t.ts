import en from "@/lib/i18n/messages/en";
import ro from "@/lib/i18n/messages/ro";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";

type MessageLeaf = string | Messages;
type Messages = { readonly [key: string]: MessageLeaf };

const messages: Record<Locale, Messages> = { ro, en };

function lookup(source: Messages, keyPath: string): string | undefined {
  let current: MessageLeaf | undefined = source;
  for (const segment of keyPath.split(".")) {
    if (!current || typeof current === "string") return undefined;
    current = current[segment];
  }
  return typeof current === "string" ? current : undefined;
}

export function t(locale: Locale, keyPath: string): string {
  return lookup(messages[locale] ?? messages[DEFAULT_LOCALE], keyPath) ?? lookup(messages.ro, keyPath) ?? keyPath;
}
