// Real-money purchases (optional supporter items). This module is separate
// from ads and from the in-game naira economy: nothing in the story can be
// bought with real money.
//
// MODE
//   mock (default)  a fake checkout that always succeeds. Clearly labelled
//                   "TEST MODE". Used in development and until a backend exists.
//   paystack        set VITE_PAYSTACK_PUBLIC_KEY and VITE_PAYMENTS=paystack.
//                   Loads Paystack's inline script and opens its popup. The
//                   payment MUST then be verified on a server (Paystack's
//                   /transaction/verify/:reference with the SECRET key) before
//                   granting anything; `verifyUrl` points at that endpoint.
//
// Entitlements are remembered in localStorage (per device).

import { create } from 'zustand'

export const PRODUCTS = {
  supporterPack: { name: 'Supporter Pack', priceKobo: 150000, blurb: 'A gold "Supporter chain" and the nickname "Supporter". Cosmetic only. Thank you!' },
  buyUsSuya: { name: 'Buy the dev suya', priceKobo: 50000, blurb: 'Nothing in the game. Just suya. With extra pepper.' },
}

const MODE = import.meta.env.VITE_PAYMENTS === 'paystack' && import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ? 'paystack' : 'mock'
const KEY = 'areaBoy.entitlements'

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage blocked: the purchase still works for this session
  }
}

// UI state for the mock checkout dialog
export const useCheckout = create((set) => ({ open: null, resolve: null, entitlements: read(), set }))

export const paymentsMode = () => MODE
export const hasEntitlement = (id) => useCheckout.getState().entitlements.includes(id)

function grant(productId) {
  const list = [...new Set([...useCheckout.getState().entitlements, productId])]
  write(list)
  useCheckout.setState({ entitlements: list })
}

function reference() {
  return `AB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Starts a purchase. Resolves { status: 'success' | 'cancelled', reference }. */
export function purchase(productId, { email = 'player@example.com', verifyUrl = '/api/verify-payment' } = {}) {
  const product = PRODUCTS[productId]
  if (!product) return Promise.resolve({ status: 'error', message: 'Unknown product' })
  const ref = reference()

  if (MODE === 'mock') {
    return new Promise((resolve) => {
      useCheckout.setState({
        open: { productId, product, ref },
        resolve: (ok) => {
          useCheckout.setState({ open: null, resolve: null })
          if (ok) grant(productId)
          resolve({ status: ok ? 'success' : 'cancelled', reference: ref, mock: true })
        },
      })
    })
  }

  // Paystack inline (needs network access to js.paystack.co and a backend to verify)
  return new Promise((resolve) => {
    const start = () => {
      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email,
        amount: product.priceKobo,
        currency: 'NGN',
        ref,
        callback: async (res) => {
          try {
            const r = await fetch(`${verifyUrl}?reference=${encodeURIComponent(res.reference)}`)
            const ok = r.ok && (await r.json()).status === 'success'
            if (ok) grant(productId)
            resolve({ status: ok ? 'success' : 'error', reference: res.reference })
          } catch {
            resolve({ status: 'error', reference: res.reference })
          }
        },
        onClose: () => resolve({ status: 'cancelled', reference: ref }),
      })
      handler.openIframe()
    }
    if (window.PaystackPop) return start()
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.onload = start
    s.onerror = () => resolve({ status: 'error', message: 'Could not reach Paystack' })
    document.head.appendChild(s)
  })
}
