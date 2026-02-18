import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Heart, Shield, ArrowRight, Video, ArrowLeft, Loader } from 'lucide-react';
import { createCheckoutSession } from '../lib/stripe';
import { useSessionStore } from '../store/session';

const Auth = lazy(() => import('./Auth'));
const ProfileSetup = lazy(() => import('./ProfileSetup'));

const LoadingFallback = ({ message = 'Loading...' }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <Loader className="w-8 h-8 text-purple-500 animate-spin mb-4" />
    <p className="text-gray-600 dark:text-gray-300">{message}</p>
  </div>
);

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'hero' | 'uplifter' | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const handleRoleSelect = (selectedRole: 'hero' | 'uplifter') => {
    setLoading(true);
    setTimeout(() => {
      setRole(selectedRole);
      setStep(2);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    const storedRole = localStorage.getItem('role') as 'hero' | 'uplifter' | null;
    const username = localStorage.getItem('username');
    if (storedRole) {
      setRole(storedRole);
      if (username) {
        onComplete();
      }
    }
  }, [onComplete]);

  const handleBack = () => {
    setLoading(true);
    setTimeout(() => {
      if (step > 1) setStep(step - 1);
      setLoading(false);
    }, 300);
  };

  const handleAuthSuccess = async (isNewUser: boolean) => {
    setLoading(true);
    setLoadingMessage('Authenticating...');
    setTimeout(() => {
      if (isNewUser) {
        setStep(3);
      } else {
        onComplete();
      }
      setLoading(false);
      setLoadingMessage(null);
    }, 800);
  };

  const handleProfileComplete = () => {
    setLoading(true);
    setLoadingMessage('Finalizing profile...');
    setTimeout(() => {
      handleComplete();
      setLoading(false);
      setLoadingMessage(null);
    }, 1000);
  };

  const handleSubscribe = async () => {
    if (!role) return;
    setLoading(true);
    setLoadingMessage('Taking you to subscribe...');
    // Complete onboarding so user lands on app; they can complete payment on the Subscription page (requires login).
    setTimeout(() => {
      setLoading(false);
      setLoadingMessage(null);
      onComplete();
    }, 800);
  };

  const handleComplete = () => {
    if (role) {
      setLoading(true);
      setLoadingMessage('Finalizing your account...');
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage(null);
        onComplete();
      }, 1000);
    }
  };

  if (loading || loadingMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <LoadingFallback message={loadingMessage || 'Loading...'} />
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Welcome to UpliftMe</h1>
              <p className="text-gray-600 dark:text-gray-300">Choose your role to start meaningful video conversations</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect('hero')}
                className="w-full p-6 rounded-xl border-2 border-transparent hover:border-purple-500 bg-gray-50 dark:bg-gray-700 transition-all"
              >
                <div className="flex items-center space-x-4 mb-4">
                  <Shield className="w-8 h-8 text-purple-500" />
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">I need motivation</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Join as a Hero</p>
                  </div>
                </div>
                <p className="text-sm text-left text-gray-600 dark:text-gray-300">Connect with supportive Uplifters who will motivate and inspire you through video chat</p>
              </button>

              <button
                onClick={() => handleRoleSelect('uplifter')}
                className="w-full p-6 rounded-xl border-2 border-transparent hover:border-pink-500 bg-gray-50 dark:bg-gray-700 transition-all"
              >
                <div className="flex items-center space-x-4 mb-4">
                  <Heart className="w-8 h-8 text-pink-500" />
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">I want to motivate</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Join as an Uplifter</p>
                  </div>
                </div>
                <p className="text-sm text-left text-gray-600 dark:text-gray-300">Use video chat to inspire others, share positivity, and earn rewards for making a difference</p>
              </button>
            </div>

            <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Video className="w-5 h-5 text-purple-500" />
                <h4 className="font-semibold">7-Minute Video Sessions</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Quick, meaningful face-to-face conversations that fit your schedule</p>
            </div>
            <button
              onClick={() => {
                setRole('hero');
                setStep(4);
              }}
              className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Subscribe Now
            </button>
          </div>
        );
      case 2:
        return (
          <Suspense fallback={<LoadingFallback message="Loading authentication..." />}>
            <Auth onSuccess={handleAuthSuccess} />
          </Suspense>
        );
      case 3:
        return role && (
          <Suspense fallback={<LoadingFallback message="Loading profile setup..." />}>
            <ProfileSetup role={role} onComplete={handleProfileComplete} />
          </Suspense>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Subscribe to UpliftMe</h2>
              <p className="text-gray-600 dark:text-gray-300">
                {role === 'hero' ? 'Get instant video motivation from our amazing Uplifters' : 'Help others through uplifting video conversations'}
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-gray-700 p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Monthly Subscription</h3>
                <div className="text-2xl font-bold">$9.99</div>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><ArrowRight className="w-4 h-4 text-purple-500 mr-2" /> Unlimited video sessions</li>
                <li className="flex items-center"><ArrowRight className="w-4 h-4 text-purple-500 mr-2" /> Priority matching</li>
                <li className="flex items-center"><ArrowRight className="w-4 h-4 text-purple-500 mr-2" /> Access to advanced features</li>
                <li className="flex items-center"><ArrowRight className="w-4 h-4 text-purple-500 mr-2" /> Community perks and rewards</li>
              </ul>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center"
              >
                {loading ? <><Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Processing...</> : 'Subscribe Now'}
              </button>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Continue with Free Trial
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="mb-6 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        )}
        {renderStep()}
      </div>
    </div>
  );
};

export default WelcomeScreen;