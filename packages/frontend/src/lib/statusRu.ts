export function userStatusLabelRu(status: string): string {
  switch (status) {
    case 'PENDING_EMAIL_CONFIRMATION':
      return 'Ожидает подтверждения email'
    case 'PENDING_TELEGRAM_LINK':
      return 'Ожидает привязки Telegram'
    case 'ACTIVE':
      return 'Активен'
    case 'SUSPENDED':
      return 'Приостановлен'
    case 'BANNED':
      return 'Заблокирован'
    default:
      return 'Неизвестный статус'
  }
}

export function bookingSettlementStatusLabelRu(status: string | null | undefined): string {
  switch (status) {
    case 'PENDING':
      return 'Ожидает расчета'
    case 'SETTLED':
      return 'Расчет выполнен'
    case 'FAILED':
      return 'Ошибка расчета'
    case 'CANCELED':
      return 'Расчет отменен'
    case null:
    case undefined:
      return 'Не применимо'
    default:
      return 'Неизвестный статус'
  }
}
