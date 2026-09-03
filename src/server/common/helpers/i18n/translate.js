import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { getLocale } from './get-locale.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const localesPath = path.resolve(dirname, '../../../locales')
const DEFAULT_LOCALE = 'en'
const dictionariesCache = {}

function loadDictionary(locale) {
  if (!dictionariesCache[locale]) {
    const filePath = path.join(localesPath, `${locale}.json`)
    dictionariesCache[locale] = JSON.parse(readFileSync(filePath, 'utf-8'))
  }

  return dictionariesCache[locale]
}

function getNestedValue(obj, key) {
  return key
    .split('.')
    .reduce(
      (acc, current) => (acc && current in acc ? acc[current] : undefined),
      obj
    )
}

function getLocaleString(dictionary, key) {
  const value = getNestedValue(dictionary, key)

  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  return value
}

function interpolate(template, params) {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, paramName) =>
    paramName in params ? String(params[paramName]) : ''
  )
}

export function translate(locale, key, params = {}) {
  const requestedDictionary = loadDictionary(locale)
  const defaultDictionary =
    locale === DEFAULT_LOCALE
      ? requestedDictionary
      : loadDictionary(DEFAULT_LOCALE)

  const value =
    getLocaleString(requestedDictionary, key) ??
    getLocaleString(defaultDictionary, key) ??
    key

  if (typeof value !== 'string') {
    return key
  }

  return interpolate(value, params)
}

export function pageI18n(locale, pageLocaleBase) {
  return {
    t(key, params = {}) {
      return translate(locale, `${pageLocaleBase}.${key}`, params)
    }
  }
}

export function buildPageViewModel(request, pageKey) {
  const locale = getLocale(request)

  return {
    pageTitle: translate(locale, `${pageKey}.pageTitle`),
    heading: translate(locale, `${pageKey}.heading`)
  }
}

/** Clears cached dictionaries — for tests only. */
export function clearLocaleCacheForTests() {
  for (const key of Object.keys(dictionariesCache)) {
    delete dictionariesCache[key]
  }
}

/** Seeds a cached dictionary — for tests only. */
export function seedLocaleDictionaryForTests(locale, dictionary) {
  dictionariesCache[locale] = dictionary
}
