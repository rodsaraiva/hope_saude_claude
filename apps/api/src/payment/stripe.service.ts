import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe('sk_test_MOCK', {
      apiVersion: '2022-11-15' as any,
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'brl') {
    return this.stripe.paymentIntents.create({
      amount: amount * 100, // em centavos
      currency,
    });
  }

  async verifyPayment(paymentId: string) {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
    return paymentIntent.status === 'succeeded';
  }
}
