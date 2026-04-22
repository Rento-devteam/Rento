/** Полная перезагрузка главной после входа, чтобы каталог заново запросился с JWT. */
export function reloadHomeAfterLogin(): void {
  window.location.assign('/')
}
