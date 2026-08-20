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
  onCompleted: () => void
}

function initialize(input: OpenPaddleCheckoutInput) {
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
    },
  })
}
