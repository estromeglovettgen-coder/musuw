import {
  CheckoutEventNames,
  initializePaddle,
  type Paddle,
  type PaddleEventData,
} from '@paddle/paddle-js'

let paddlePromise: Promise<Paddle | undefined> | null = null
let completed: (() => void) | undefined

export interface OpenPaddleCheckoutInput {
  environment: 'sandbox' | 'live'
  clientToken: string
  priceId: string
  tenantId: string
  checkoutBinding: string
  email?: string
  locale?: string
  onCompleted: () => void
}

export interface PreviewPaddlePricesInput {
  environment: 'sandbox' | 'live'
  clientToken: string
  priceIds: string[]
}

export interface PaddleLocalizedPrice {
  priceId: string
  formattedUnitTotal: string
  currencyCode: string
}

function toPaddleLocale(value?: string): string | undefined {
  const locale = value?.trim().toLowerCase()
  if (!locale) return undefined
  if (locale === 'zh' || locale.startsWith('zh-')) return 'zh-Hans'
  if (locale === 'ko' || locale.startsWith('ko-')) return 'ko'
  if (locale === 'ru' || locale.startsWith('ru-')) return 'ru'
  return 'en'
}

function initialize(input: Pick<OpenPaddleCheckoutInput, 'environment' | 'clientToken'>) {
  if (paddlePromise) return paddlePromise
  const eventCallback = (event: PaddleEventData) => {
    if (event.name !== CheckoutEventNames.CHECKOUT_COMPLETED) return
    const callback = completed
    completed = undefined
    callback?.()
  }
  paddlePromise = initializePaddle({
    ...(input.environment === 'sandbox' ? { environment: 'sandbox' as const } : {}),
    token: input.clientToken,
    eventCallback,
  }).catch((error) => {
    paddlePromise = null
    throw error
  })
  return paddlePromise
}

export async function previewPaddlePrices(input: PreviewPaddlePricesInput): Promise<PaddleLocalizedPrice[]> {
  const priceIds = [...new Set(input.priceIds.map((value) => value.trim()).filter(Boolean))]
  if (!priceIds.length) return []
  const paddle = await initialize(input)
  if (!paddle) throw new Error('Paddle.js failed to initialize')
  const preview = await paddle.PricePreview({
    items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
  })
  return preview.data.details.lineItems.map((item) => ({
    priceId: item.price.id,
    formattedUnitTotal: item.formattedUnitTotals.total,
    currencyCode: preview.data.currencyCode,
  }))
}

export async function openPaddleCheckout(input: OpenPaddleCheckoutInput): Promise<void> {
  completed = input.onCompleted
  const paddle = await initialize(input)
  if (!paddle) throw new Error('Paddle.js failed to initialize')
  paddle.Checkout.open({
    items: [{ priceId: input.priceId, quantity: 1 }],
    customData: {
      tenant_id: input.tenantId,
      musuw_checkout_binding: input.checkoutBinding,
    },
    customer: input.email ? { email: input.email } : undefined,
    settings: {
      displayMode: 'overlay',
      theme: 'light',
      allowLogout: false,
      locale: toPaddleLocale(input.locale),
    },
  })
}
