import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useSessionStore } from '../store/session';
// import { Card, CardContent, Typography, Box, Chip } from "@mui/material";
// const stripePromise = loadStripe(import.meta.env.STRIPE_SECRET_KEY || "");
const stripePromise = loadStripe("pk_test_51SwzBiRt8kNCRZHOHRXHk8II9rDSpPxwrGnSkWzBzoqSWSvBjPlVSZAZj4g5hCrx9pjLZCsHBypxXBWElnrdKXsf00CLuudVg3");

const CheckoutForm = ({
  plan
}: {
  plan: 'weekly' | 'session10';
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { subscription } = useSessionStore.getState();
  const handlePayment = async () => {
    if (!stripe || !elements) return;


    setLoading(true);

    try {
      if (subscription.hasWeeklySubscription && subscription.sessionBalance > 0){
          throw new Error(
            'You already have an active weekly subscription or session balance. Please use your existing sessions before purchasing a new plan.'
          );
        }

        // if (!subscription.hasExtendedSubscription && subscription.sessionBalance > 0) {
        //   throw new Error(
        //     'You already have an active extended subscription or session balance. Please use your existing sessions before purchasing a new plan.'
        //   );
        // }
      else {
        const payload = {
          planType: plan === 'weekly' ? 'weekly' : 'extended'
        };

        const apiBase = import.meta.env.VITE_SERVER_URI || 'http://localhost:4000';
        const res = await fetch(`${apiBase}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Payment intent creation failed');
        console.log('Payment intent created:', data);

        // Confirm payment using Stripe Elements
        const result = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        });
        console.log('Payment result:', result);
        if (result.error) {
          alert(result.error.message);
        } else if (result.paymentIntent?.status === 'succeeded') {
          alert('✅ Payment successful!');
          document.location.href = '/'; // Redirect to dashboard
        }
      }
      // Build payload based on plan

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <CardElement className="border p-3 rounded-md bg-white" />
      <button
        onClick={handlePayment}
        disabled={loading || !stripe}
        className="w-full px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
};
;


const Subscription: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'session10' | null>(null);
  const { subscription } = useSessionStore()
  console.log(subscription);
  return (
    <Elements stripe={stripePromise}>
      <div className="px-4 sm:px-6 lg:px-8 max-w-lg mx-auto pt-20 space-y-8">

        {/* Weekly Plan */}
        {subscription.hasWeeklySubscription ? (
          subscription.sessionBalance === 0 ?
            (
              <section className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Extend Weekly Plan
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Purchase <span className="font-semibold">10 sessions</span> for <span className="font-semibold">€25</span>.
                </p>
                <button
                  onClick={() => setSelectedPlan('session10')}
                  className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:brightness-110 transition"
                >
                  Choose Pack
                </button>
                {selectedPlan === 'session10' && (
                  <div className="mt-6">
                    <CheckoutForm plan="session10" />
                  </div>
                )}
              </section>
            )
            : (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-2xl mx-auto">
                <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed">
                  You have
                  <span className="inline-block bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-semibold px-2 py-0.5 mx-1 rounded">
                    {subscription.sessionBalance} remaining sessions
                  </span>
                  — please use them before subscribing to a new plan.
                </p>
              </div>
            )
        ) : (
          <section className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Weekly Subscription
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Purchase Weekly Subscription with <span className="font-semibold">3 sessions</span> for <span className="font-semibold">€9.99</span>.
            </p>
            <button
              onClick={() => setSelectedPlan('weekly')}
              className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:brightness-110 transition"
            >
              Choose Plan
            </button>
            {selectedPlan === 'weekly' && (
              <div className="mt-6">
                <CheckoutForm plan="weekly" />
              </div>
            )}
          </section>
        )}
      </div>
    </Elements>
  );

};

export default Subscription;


// import React, { useState, useRef } from 'react';
// import { loadStripe } from '@stripe/stripe-js';
// import {
//   Elements,
//   CardElement,
//   useStripe,
//   useElements
// } from '@stripe/react-stripe-js';
// import { useSessionStore } from '../store/session';
// import { toast } from 'sonner';

// const stripePromise = loadStripe("pk_test_51SwzBiRt8kNCRZHOHRXHk8II9rDSpPxwrGnSkWzBzoqSWSvBjPlVSZAZj4g5hCrx9pjLZCsHBypxXBWElnrdKXsf00CLuudVg3");

// const CheckoutForm = ({
//   plan
// }: {
//   plan: 'weekly' | 'session10';
// }) => {
//   const stripe = useStripe();
//   const elements = useElements();
//   const [loading, setLoading] = useState(false);
//   const { subscription } = useSessionStore();
  
//   // Use ref to prevent duplicate payment intents
//   const paymentInProgressRef = useRef(false);

//   const handlePayment = async () => {
//     // Prevent multiple simultaneous payment attempts
//     if (paymentInProgressRef.current) {
//       console.log('⚠️ Payment already in progress, ignoring click');
//       return;
//     }

//     if (!stripe || !elements) {
//       toast.error('Stripe has not loaded yet. Please wait.');
//       return;
//     }

//     // Validate card element
//     const cardElement = elements.getElement(CardElement);
//     if (!cardElement) {
//       toast.error('Card information is missing.');
//       return;
//     }

//     // Set flag to prevent duplicate requests
//     paymentInProgressRef.current = true;
//     setLoading(true);

//     try {
//       // Check subscription status before payment
//       if (plan === 'weekly' && subscription.hasWeeklySubscription && subscription.sessionBalance > 0) {
//         throw new Error(
//           'You already have an active weekly subscription with remaining sessions. Please use your existing sessions before purchasing a new plan.'
//         );
//       }

//       if (plan === 'session10' && subscription.hasExtendedSubscription && subscription.sessionBalance > 0) {
//         throw new Error(
//           'You already have an active extended subscription with remaining sessions. Please use your existing sessions before purchasing a new plan.'
//         );
//       }

//       // Prepare payload
//       const payload = {
//         planType: plan === 'weekly' ? 'weekly' : 'extended'
//       };

//       console.log('💳 Creating payment intent for:', payload);

//       // Create payment intent - THIS SHOULD ONLY HAPPEN ONCE
//       const res = await fetch('http://localhost:4000/api/payments', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         credentials: 'include',
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();
      
//       if (!res.ok) {
//         throw new Error(data.message || 'Payment intent creation failed');
//       }

//       console.log('✅ Payment intent response:', data);
//       console.log('📝 Client Secret:', data.clientSecret);

//       // Validate client secret
//       if (!data.clientSecret) {
//         throw new Error('Invalid response from server: missing clientSecret');
//       }

//       // Validate that clientSecret contains "_secret_"
//       if (!data.clientSecret.includes('_secret_')) {
//         throw new Error('Invalid client secret format received from server');
//       }

//       console.log('💳 Confirming payment with Stripe...');

//       // Confirm payment using Stripe - THIS USES THE NEWLY CREATED INTENT
//       const result = await stripe.confirmCardPayment(data.clientSecret, {
//         payment_method: {
//           card: cardElement,
//           billing_details: {
//             // Add optional billing details if needed
//           },
//         },
//       });

//       console.log('📋 Payment result:', result);

//       if (result.error) {
//         // Payment failed
//         console.error('❌ Payment error:', result.error);
//         throw new Error(result.error.message || 'Payment failed');
//       } else if (result.paymentIntent?.status === 'succeeded') {
//         // Payment succeeded
//         console.log('✅ Payment succeeded!', result.paymentIntent.id);
        
//         toast.success('Payment successful! 🎉', {
//           description: 'Your subscription has been activated.',
//         });
        
//         // Refresh subscription data
//         await useSessionStore.getState().fetchUserStats2();
        
//         // Redirect to dashboard after short delay
//         setTimeout(() => {
//           window.location.href = '/';
//         }, 2000);
//       }

//     } catch (err: any) {
//       console.error('❌ Payment error:', err);
//       toast.error(err.message || 'Something went wrong with your payment');
//     } finally {
//       setLoading(false);
//       // Reset the flag so user can try again if there was an error
//       paymentInProgressRef.current = false;
//     }
//   };

//   return (
//     <div className="space-y-4 mt-4">
//       <div className="border p-3 rounded-md bg-white">
//         <CardElement 
//           options={{
//             style: {
//               base: {
//                 fontSize: '16px',
//                 color: '#424770',
//                 '::placeholder': {
//                   color: '#aab7c4',
//                 },
//               },
//               invalid: {
//                 color: '#9e2146',
//               },
//             },
//           }}
//         />
//       </div>
//       <button
//         onClick={handlePayment}
//         disabled={loading || !stripe}
//         className="w-full px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
//       >
//         {loading ? 'Processing...' : 'Pay Now'}
//       </button>
      
//       {/* Debug info - remove in production */}
//       {process.env.NODE_ENV === 'development' && (
//         <div className="text-xs text-gray-500 mt-2">
//           <p>Plan: {plan}</p>
//           <p>Processing: {loading ? 'Yes' : 'No'}</p>
//         </div>
//       )}
//     </div>
//   );
// };

// const Subscription: React.FC = () => {
//   const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'session10' | null>(null);
//   const { subscription } = useSessionStore();
  
//   console.log('Current subscription:', subscription);

//   return (
//     <Elements stripe={stripePromise}>
//       <div className="px-4 sm:px-6 lg:px-8 max-w-lg mx-auto pt-20 space-y-8">

//         {/* Weekly Plan Section */}
//         {subscription.hasWeeklySubscription ? (
//           subscription.sessionBalance === 0 ? (
//             // User has weekly subscription but no sessions left
//             <section className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8">
//               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
//                 Extend Weekly Plan
//               </h2>
//               <p className="text-gray-600 dark:text-gray-300 mb-6">
//                 Purchase <span className="font-semibold">10 sessions</span> for <span className="font-semibold">€25</span>.
//               </p>
//               <button
//                 onClick={() => setSelectedPlan('session10')}
//                 className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:brightness-110 transition"
//               >
//                 Choose Pack
//               </button>
//               {selectedPlan === 'session10' && (
//                 <div className="mt-6">
//                   <CheckoutForm plan="session10" />
//                 </div>
//               )}
//             </section>
//           ) : (
//             // User has weekly subscription with remaining sessions
//             <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-2xl mx-auto">
//               <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed">
//                 You have
//                 <span className="inline-block bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-semibold px-2 py-0.5 mx-1 rounded">
//                   {subscription.sessionBalance} remaining session{subscription.sessionBalance !== 1 ? 's' : ''}
//                 </span>
//                 — please use them before subscribing to a new plan.
//               </p>
//             </div>
//           )
//         ) : (
//           // User doesn't have weekly subscription
//           <section className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8">
//             <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
//               Weekly Subscription
//             </h2>
//             <p className="text-gray-600 dark:text-gray-300 mb-6">
//               Purchase Weekly Subscription with <span className="font-semibold">3 sessions</span> for <span className="font-semibold">€9.99</span>.
//             </p>
//             <button
//               onClick={() => setSelectedPlan('weekly')}
//               className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:brightness-110 transition"
//             >
//               Choose Plan
//             </button>
//             {selectedPlan === 'weekly' && (
//               <div className="mt-6">
//                 <CheckoutForm plan="weekly" />
//               </div>
//             )}
//           </section>
//         )}

//         {/* Extended Plan Section (optional) */}
//         {subscription.hasExtendedSubscription && subscription.sessionBalance > 0 && (
//           <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-2xl mx-auto">
//             <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed">
//               You have an extended subscription with
//               <span className="inline-block bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-semibold px-2 py-0.5 mx-1 rounded">
//                 {subscription.sessionBalance} remaining session{subscription.sessionBalance !== 1 ? 's' : ''}
//               </span>
//             </p>
//           </div>
//         )}
//       </div>
//     </Elements>
//   );
// };

// export default Subscription;