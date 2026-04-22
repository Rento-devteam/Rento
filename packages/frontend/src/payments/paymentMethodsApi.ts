import { apiRequest } from '../lib/apiClient'

export type BankCard = {
  id: string
  last4: string
  cardType: string
  isDefault: boolean
  addedAt: string
}

type BankCardListResponse = {
  items: BankCard[]
}

export async function listPaymentMethods(accessToken: string): Promise<BankCard[]> {
  const response = await apiRequest<BankCardListResponse>('/payment/methods', {
    method: 'GET',
    accessToken,
  })
  return response.items
}

export async function attachCard(params: {
  accessToken: string
  token: string
  setAsDefault?: boolean
}): Promise<BankCard> {
  return apiRequest<BankCard>('/payment/cards/add', {
    method: 'POST',
    accessToken: params.accessToken,
    body: JSON.stringify({
      token: params.token,
      setAsDefault: params.setAsDefault,
    }),
  })
}

export async function setDefaultCard(accessToken: string, cardId: string): Promise<BankCard> {
  return apiRequest<BankCard>(`/payment/cards/${cardId}/default`, {
    method: 'PATCH',
    accessToken,
  })
}

export async function removeCard(accessToken: string, cardId: string): Promise<void> {
  await apiRequest<void>(`/payment/cards/${cardId}`, {
    method: 'DELETE',
    accessToken,
  })
}
