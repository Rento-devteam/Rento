import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

/**
 * In-memory Web Storage. Some Node/Cursor setups pass broken globals
 * (`--localstorage-file` without a path), where `localStorage.getItem` is not a function.
 * Vitest/jsdom then fails on any code touching `localStorage`.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear(): void {
      store.clear()
    },
    getItem(key: string): string | null {
      const k = String(key)
      return store.has(k) ? store.get(k)! : null
    },
    key(index: number): string | null {
      const keys = [...store.keys()]
      return keys[index] ?? null
    },
    removeItem(key: string): void {
      store.delete(String(key))
    },
    setItem(key: string, value: string): void {
      store.set(String(key), String(value))
    },
  } as Storage
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createMemoryStorage(),
  writable: true,
  configurable: true,
})

afterEach(() => {
  cleanup()
  globalThis.localStorage.clear()
})
