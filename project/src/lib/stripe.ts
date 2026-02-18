import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

export async function createPaymentIntent(amount: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
   
    // In development, simulate successful payment
    // if (import.meta.env.DEV) {
    //   return {
    //     clientSecret: 'test_secret',
    //     amount,
    //     currency: 'usd'
    //   };
    // }

    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: { amount }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Payment intent error:', error);
    throw error;
  }
}

export async function createCheckoutSession({
  userId,
  amount,
  currency,
  paymentMethod, // This would be Stripe's paymentMethod ID from frontend
}: {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}) {
  try {
    const apiBase = import.meta.env.VITE_SERVER_URI || "http://localhost:4000";
    const res = await fetch(`${apiBase}/api/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, amount, currency, paymentMethod }),
      credentials: "include"
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Payment failed");

    // You can optionally return this to show confirmation in the UI
    return { success: true, payment: data.payment };
  } catch (error) {
    console.error("Checkout session error:", error);
    throw error;
  }
}




export async function getSubscriptionStatus() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_tier, sessions_remaining')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return {
      status: data.subscription_status,
      tier: data.subscription_tier,
      sessionsRemaining: data.sessions_remaining
    };
  } catch (error) {
    console.error('Subscription status error:', error);
    throw error;
  }
}

export async function cancelSubscription() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // In development, simulate cancellation
    if (import.meta.env.DEV) {
      const { error } = await supabase
        .from('users')
        .update({
          subscription_status: 'canceled',
          subscription_tier: 'free'
        })
        .eq('id', user.id);

      if (error) throw error;
      return { success: true };
    }

    const { error } = await supabase.functions.invoke('cancel-subscription');
    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    throw error;
  }
}