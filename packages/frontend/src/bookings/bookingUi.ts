export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Ожидает'
    case 'PENDING_PAYMENT':
      return 'Ожидает оплаты'
    case 'PAYMENT_FAILED':
      return 'Оплата не прошла'
    case 'CONFIRMED':
      return 'Подтверждено'
    case 'ACTIVE':
      return 'Активно'
    case 'COMPLETED':
      return 'Завершено'
    case 'CANCELLED':
      return 'Отменено'
    case 'DISPUTED':
      return 'Спор'
    default:
      return status
  }
}
