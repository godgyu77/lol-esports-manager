import { useSyncExternalStore } from 'react';
import { resources, type I18nLocale } from './locales';

const STORAGE_KEY = 'lol-esports-manager:locale';
const DEFAULT_LOCALE: I18nLocale = 'ko';
const listeners = new Set<() => void>();

function isLocale(value: string | null | undefined): value is I18nLocale {
  return value === 'ko' || value === 'en';
}

function detectLocale(): I18nLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Ignore storage access failures and keep the app stable.
  }

  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : DEFAULT_LOCALE;
}

let currentLocale: I18nLocale = detectLocale();

function resolvePath(locale: I18nLocale, key: string): string | undefined {
  const segments = key.split('.');
  let value: unknown = resources[locale];

  for (const segment of segments) {
    if (!value || typeof value !== 'object' || !(segment in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }

  return typeof value === 'string' ? value : undefined;
}

function updateDocumentLanguage(locale: I18nLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export function getLocale(): I18nLocale {
  return currentLocale;
}

export function setLocale(locale: I18nLocale) {
  if (locale === currentLocale) return;
  currentLocale = locale;
  updateDocumentLanguage(locale);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage access failures and keep the app stable.
    }
  }

  listeners.forEach((listener) => listener());
}

export function initializeI18n() {
  currentLocale = detectLocale();
  updateDocumentLanguage(currentLocale);
}

export function t(key: string, fallback?: string): string {
  return resolvePath(currentLocale, key) ?? resolvePath(DEFAULT_LOCALE, key) ?? fallback ?? key;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
  return {
    locale,
    setLocale,
    t: (key: string, fallback?: string) => t(key, fallback),
  };
}
