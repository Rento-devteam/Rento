/** Mirrors backend `password-policy.ts` for client-side validation hints. */
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/

export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password)
}

export const PASSWORD_HINT =
  'Не менее 8 символов: заглавная и строчная буква, цифра и спецсимвол'
