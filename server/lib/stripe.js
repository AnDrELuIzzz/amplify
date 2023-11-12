// Wrappers for Stripe's npm package
require('dotenv').config()

class StripeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StripeError'
  }
}

class Stripe {
  constructor() {
    this.stripeSecret = process.env.STRIPE_SECRET_KEY
    this.stripe = require('stripe')(this.stripeSecret)
  }

  /**
   * Validates that an event actually comes from Stripe. Returns event or throws StripeError.
   * @param {string} signature - Stripe signature header.
   * @param {object} rawBody - Requests rawBody attribute.
   */
  validateEvent(signature, rawBody) {
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripeSecret
      )
    } catch (error) {
      throw new StripeError(error.message)
    }
  }

  /**
   * Creates a checkout session and returns the url and session id.
   * @param {number} donationAmount - Donation amount (in cents).
   * @param {string} customerEmail - For (optionally) pre-filling customer email on checkout page.
   */
  async createCheckoutSession(donationAmount, customerEmail = '') {
    try {
      const session = await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Donation'
              },
              unit_amount: donationAmount
            },
            quantity: 1,
            customer_email: customerEmail
          }
        ],
        mode: 'payment',
        allow_promotion_codes: true,
        success_url: '',
        cancel_url: ''
      })

      return { url: session.url, id: session.id }
    } catch (error) {
      throw new StripeError(error.message)
    }
  }
}

module.exports = { Stripe }
