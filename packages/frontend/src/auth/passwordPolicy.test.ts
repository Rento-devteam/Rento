import { describe, expect, it } from 'vitest'
import { isStrongPassword, PASSWORD_HINT } from './passwordPolicy'

describe('passwordPolicy', () => {
  it('accepts strong passwords', () => {
    expect(isStrongPassword('Aa1!aaaa')).toBe(true)
    expect(isStrongPassword('Str0ng#Pass')).toBe(true)
  })

  it('rejects short or simple passwords', () => {
    expect(isStrongPassword('short1!')).toBe(false)
    expect(isStrongPassword('alllowercase1!')).toBe(false)
    expect(isStrongPassword('NOLOWERCASE1!')).toBe(false)
    expect(isStrongPassword('NoDigits!!')).toBe(false)
    expect(isStrongPassword('NoSpecial1A')).toBe(false)
  })

  it('exports a non-empty hint string', () => {
    expect(PASSWORD_HINT.length).toBeGreaterThan(10)
  })
})
