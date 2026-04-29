export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/;

/** Согласовано с подсказкой на клиенте (`passwordPolicy.ts`). */
export const PASSWORD_FORMAT_MESSAGE =
  'Не менее 8 символов. Нужны заглавная и строчная буква, цифра и спецсимвол.';

export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}
