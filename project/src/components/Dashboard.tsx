

import React, { useState, useEffect } from 'react';
import {
  Heart, Shield, Crown, History as HistoryIcon, Settings as SettingsIcon,
  Loader, Star, RefreshCw, AlertCircle, BarChart as ChartBar, Code, LogOut, ArrowLeft, Clock, Package,
} from 'lucide-react';
import { useSessionStore } from '../store/session';
import VideoSession from './VideoSession';
import Settings from './Settings';
import History from './History';
import AdminDashboard from './AdminDashboard';
import { toast } from 'sonner';
import EmotionalSlider from './EmotionalSlider';
import socket from '../lib/socket';
// import CallComponent from "../components/CallComponent";
import { motion, AnimatePresence } from 'framer-motion';
// import LiveKitApp from '../components/LivekitApp';
import LiveKitFinalCall from '../components/LiveKitFinalCall'
// import TwilioVideoCall from '../components/CallStream';

const serverUri = import.meta.env.VITE_SERVER_URI;

interface UserStats {
  total_sessions: number;
  total_duration: number;
  average_rating: number;
  impact_score: number;
}
interface UserStats {
  total_sessions: number;
  total_duration: number;
  average_rating: number;
  impact_score: number;
}

interface MatchedUser {
  username: string;
  avatar_url?: string;
  bio?: string;
}

interface Subscription {
  hasWeeklySubscription: boolean;
  hasExtendedSubscription: boolean;
  weeklyExpiresAt?: string;
  bundleExpiresAt?: string;
  sessionBalance?: number;

}

// Add proper typing to state



const Dashboard: React.FC = () => {
  // Initialize activeTab from sessionStorage directly to prevent flicker
  const initialTab = sessionStorage.getItem('activeTab') || 'home';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [wellbeingScore, setWellbeingScore] = useState<number | null>(null);
  const [showEmotionalModal, setShowEmotionalModal] = useState(false);
  const {
    startSession,
    isActive,
    userStats,
    isSearching,
    profilePicture,
    matchedUser,
    cancelMatch,
    userStatus,
    currentRole,
    totalHeroDuration,
    totalHeroSessionsTaken,
    rating,
    switchRole,
    subscription,
    averageHeroRating,
    totalUplifterDuration,
    totalUplifterSessionsTaken,
    averageUplifterRating,
    loadCurrentRole,
    fetchUserStats,
    fetchUserStats2,
    loadUserSubscription,
    hasSubscription,
    sessionCredits,
    checkSessionAvailability,
    isDevelopment,
    toggleDevelopmentMode
  } = useSessionStore();
  const [showVideoSession, setShowVideoSession] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [findMatch, setFindMatch] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isInitLoading, setIsInitLoading] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
  // const[userStatusBySocket, setUserStatusBySocket] = useState<string | null>(null);

  // Persist active tab whenever it changes
  useEffect(() => {
    if (activeTab === 'home' && findMatch) {
      socket.connect();
    }

    if (activeTab !== 'home' && findMatch) {
      socket.disconnect();
    }

    return () => {
      // Cleanup socket connection on component unmount
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [activeTab, findMatch]);




  useEffect(() => {
    const controller = new AbortController();

    const initializeDashboard = async () => {
      setIsInitLoading(true);
      try {
        await Promise.all([
          loadCurrentRole(),
          loadUserSubscription(),
          fetchUserStats2()
        ]);
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        toast.error('Failed to load your data. Please refresh the page.');
      } finally {
        if (!controller.signal.aborted) {
          setIsInitLoading(false);
          setTimeout(() => setFadeIn(true), 100);
        }
      }
    };

    initializeDashboard();

    return () => {
      controller.abort();
    };
  }, [loadCurrentRole, fetchUserStats2, loadUserSubscription]);

  const handleLogOut = async () => {
    try {
      setIsLoggingOut(true);
      toast.loading("Logging out...");

      localStorage.clear();
      const response = await fetch(`http://localhost:4000/api/user/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      toast.success("Logged out successfully");

      // Redirect to login page
      window.location.reload();

    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  // console.log(subscription);


  const handleFindMatch = async () => {
    if (!currentRole) {
      toast.error('Please select a role first');
      return;
    }

    if (currentRole === 'hero' && wellbeingScore === null) {
      setShowEmotionalModal(true);
      return;
    }

    try {
      setIsStartingSession(true);
      const availability = await checkSessionAvailability();

      if (!availability.canStart && !isDevelopment) {
        setShowSubscribePrompt(true);
        setIsStartingSession(false);
        return;
      }

      if (availability.reason === 'free_trial') {
        toast.info('Using your free trial session!');
      }

      await startSession(currentRole);
      setShowVideoSession(true);
    } catch (error) {
      console.error('Failed to find match:', error);
      toast.error('Failed to find a match. Please try again.');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleFindMatch2 = async () => {
    setFindMatch(true);
  }

  const handleCloseSession = async () => {
    const closeToastId = toast.loading("Closing session...");
    try {
      await cancelMatch();
      setShowVideoSession(false);
      toast.success("Session closed successfully", { id: closeToastId });
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error('Error closing session', { id: closeToastId });
      setShowVideoSession(false);
    }
  };



  const handleSwitchRole = async () => {
    try {
      setSwitchingRole(true);
      const switchToastId = toast.loading(`Switching to ${currentRole === 'hero' ? 'Uplifter' : 'Hero'} mode...`);
      await switchRole();
      toast.success(`Switched to ${currentRole === 'hero' ? 'Uplifter' : 'Hero'} mode`, { id: switchToastId });
    } catch (error) {
      console.error('Failed to switch role:', error);
      toast.error('Failed to switch role. Please try again.');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleBackFromMatch = async () => {
    try {
      setFindMatch(false);
      setActiveTab('home');
      sessionStorage.setItem('activeTab', 'home');
      await socket.disconnect(); // Add error handling for socket disconnect
      await fetchUserStats2();
    } catch (error) {
      console.error('Error during match exit:', error);
      toast.error('Error leaving match. Please try again.');
    }
  };

  const handleTabChange = (tab: string) => {
    // Set short loading state for visual feedback
    setLoading(true);
    setActiveTab(tab);
    // Store in session storage immediately
    sessionStorage.setItem('activeTab', tab);
    // Simulate tab content loading
    setTimeout(() => setLoading(false), 300);
  };

  const renderWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning!";
    if (hour < 18) return "Good Afternoon!";
    return "Good Evening!";
  };

  const getRoleBadgeColor = () => {
    if (currentRole === 'uplifter') return 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-200';
    if (currentRole === 'hero') return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200';
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200';
  };

  const renderContent = () => {
    if (isInitLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <Loader className="w-12 h-12 animate-spin text-purple-500 mb-4" />
          <p className="text-lg font-medium">Loading your dashboard...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'settings':
        return loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : <Settings />;
      case 'history':
        return loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : <History />;
      case 'admin':
        return loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : <AdminDashboard />;
      default:
        return (


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto px-4 py-8"
          >
            <motion.div
              whileHover={{ y: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow hover:shadow-lg rounded-2xl px-6 py-3 w-full max-w-5xl mx-auto relative">

              <div className=" absolute ml-4 md:absolute -left-6">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white">
                  <img src={profilePicture} alt="Profile Picture" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="pl-24 flex-1 flex items-center">
                <span className="text-xl font-semibold text-white">{localStorage.getItem('username')}</span>
              </div>
              {!findMatch && (<>
                <button
                  onClick={handleLogOut}
                  disabled={isLoggingOut}
                  className=" flex items-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:bg-purple-600 font-semibold py-2 px-4 rounded-lg shadow hover:shadow-lg transition duration-300">


                  {isLoggingOut ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />

                    </>
                  ) : (
                    <> <LogOut className="h-5 w-5" />
                      <span className="ml-2">Logout</span>
                    </>
                  )}
                </button>

              </>
              )}
              {findMatch && (
                <button
                  onClick={() => handleBackFromMatch()}
                  // className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition shadow-md"
                  className="flex items-center bg-pink-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded shadow-md transition-colors"
                  disabled={isLoggingOut}
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
              )}

            </motion.div>


            <div className="mb-8 mt-8 flex justify-between items-center">

              {
                !findMatch && (
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{renderWelcomeMessage()}</h1>
                    <p className="text-gray-600 dark:text-gray-300">Ready to make a difference today?</p>
                  </div>
                )
              }



            </div>

            {findMatch ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6"
              >
                {currentRole === 'hero' && (
                  subscription?.hasExtendedSubscription || subscription?.hasWeeklySubscription ? (
                    <LiveKitFinalCall />
                  ) : (
                    <div className="text-center p-4">
                      <h2 className="text-xl font-semibold text-red-600 mb-2">
                        Access Restricted
                      </h2>
                      <p className="text-gray-700">
                        Your subscription has ended. Please subscribe to continue using this feature.
                      </p>
                    </div>
                  )
                )}
                {currentRole === "uplifter" && <LiveKitFinalCall />}

              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Start Session Card */}


                {userStatus === 'block' ? (
                  <motion.div
                    className="bg-red-500 rounded-xl shadow-lg p-6 text-white"
                  >
                    <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
                    <p className="text-white/90">You have been blocked by the admin. Please contact support for more information.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    whileHover={{ y: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white"
                  >
                    <div className="flex items-center justify-between mb-4">
                      {
                        userStatus === 'pending' ? (
                          <div className="flex items-center">
                            <AlertCircle className="w-6 h-6 mr-2" />
                            <span className="text-yellow-300">Pending Approval</span>
                          </div>
                        ) : (
                          <h2 className="text-xl font-semibold">Start a Session</h2>
                        )
                      }

                      {currentRole === 'uplifter' ? (
                        <Heart className="w-6 h-6" />
                      ) : (
                        <Shield className="w-6 h-6" />
                      )}
                    </div>

                    <p className="mb-4 text-white/90">
                      {userStatus === 'pending' ? (
                        'Your account is under review. You will be able to start a session once approved.'
                      ) : currentRole === 'uplifter' ? (
                        'Connect instantly with someone who needs your support'
                      ) : (
                        'Connect with a supportive Uplifter who will motivate you'
                      )}
                    </p>

                    {userStatus === 'pending' ? null : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleFindMatch2}
                        disabled={isSearching || isActive || isStartingSession}
                        className="w-full py-3 px-4 bg-white text-purple-500 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center shadow-md"
                      >
                        {isSearching ? (
                          <>
                            <Loader className="w-5 h-5 mr-2 animate-spin" />
                            Finding Match...
                          </>
                        ) : isStartingSession ? (
                          <>
                            <Loader className="w-5 h-5 mr-2 animate-spin" />
                            Starting Session...
                          </>
                        ) : isActive ? (
                          'Session in Progress'
                        ) : (
                          'Find Match'
                        )}
                      </motion.button>
                    )}
                  </motion.div>
                )}

                {/* Role Switch Card */}
                <motion.div
                  whileHover={{ y: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Current Role</h2>
                    {currentRole !== 'admin' && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSwitchRole}
                        disabled={isActive || isSearching || switchingRole || isLoggingOut}
                        className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center shadow-sm"
                      >
                        {switchingRole ? (
                          <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Switching...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Switch Role
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className={`p-3 rounded-full ${currentRole === 'uplifter' ? 'bg-pink-100 dark:bg-pink-900' :
                      currentRole === 'hero' ? 'bg-purple-100 dark:bg-purple-900' :
                        'bg-blue-100 dark:bg-blue-900'
                      }`}>
                      {currentRole === 'uplifter' ? (
                        <Heart className="w-8 h-8 text-pink-500 dark:text-pink-300" />
                      ) : currentRole === 'hero' ? (
                        <Shield className="w-8 h-8 text-purple-500 dark:text-purple-300" />
                      ) : (
                        <Crown className="w-8 h-8 text-blue-500 dark:text-blue-300" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold capitalize">{currentRole || 'Hero'}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor()}`}>
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {currentRole === 'uplifter' && 'You are helping others'}
                        {currentRole === 'hero' && 'You are seeking support'}
                        {currentRole === 'admin' && 'You have administrative access'}
                      </p>
                    </div>
                  </div>
                </motion.div>




                {/* Stats Card */}
                <motion.div
                  whileHover={{ y: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Your Stats</h2>
                    <ChartBar className="w-6 h-6 text-purple-500" />
                  </div>
                  {isInitLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader className="w-6 h-6 animate-spin text-purple-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Sessions</p>
                          <HistoryIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        </div>

                        {currentRole === "hero" && (<p className="text-xl font-bold mt-2">{totalHeroSessionsTaken ? totalHeroSessionsTaken : '0'}</p>)}
                        {
                          currentRole === "uplifter" && (<p className="text-xl font-bold mt-2">{
                            totalUplifterSessionsTaken ? totalUplifterSessionsTaken : '0'
                          }</p>)
                        }
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Rating</p>
                          <Star className="w-4 h-4 text-yellow-400" />
                        </div>

                        {currentRole === "hero" && (<p className="text-xl font-bold mt-2">0.0</p>)}
                        {
                          currentRole === "uplifter" && (<p className="text-xl font-bold mt-2">{rating ? (rating).toFixed(1) : '0.0'}</p>)
                        }
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Impact</p>
                          <Shield className="w-4 h-4 text-purple-400" />
                        </div>
                        {currentRole === "hero" && (<p className="text-xl font-bold mt-2">{averageHeroRating ? (averageHeroRating).toFixed(1) : '0.0'}</p>)}
                        {
                          currentRole === "uplifter" && (<p className="text-xl font-bold mt-2">{averageUplifterRating ? (averageUplifterRating).toFixed(1) : '0.0'}</p>)
                        }
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Hours</p>
                          <Code className="w-4 h-4 text-blue-400" />
                        </div>
                        {currentRole === "hero" && (<p className="text-xl font-bold mt-2">{totalHeroDuration ? (<div>   {Math.floor(totalHeroDuration / 3600)}h{" "}
                          {Math.floor((totalHeroDuration % 3600) / 60)}m{" "}
                          {totalHeroDuration % 60}s</div>) : '0.0'}
                        </p>)}
                        {
                          currentRole === "uplifter" && (<p className="text-xl font-bold mt-2">{totalUplifterDuration ? (<div>   {Math.floor(totalUplifterDuration / 3600)}h{" "}
                            {Math.floor((totalUplifterDuration % 3600) / 60)}m{" "}
                            {totalUplifterDuration % 60}s</div>) : '0.0'}
                          </p>)
                        }
                      </div>
                    </div>
                  )}
                </motion.div>

                {  /* Subscription Card */}
                {(subscription?.hasWeeklySubscription || subscription?.hasExtendedSubscription || subscription?.specialKeyAccess) && (
                  <motion.div
                    whileHover={{
                      y: -5,
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-semibold">Subscription Details</h2>
                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                        <span className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          {subscription.sessionBalance}
                        </span>{" "}
                        remaining sessions
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">

                      {/* Show Weekly/Extended/Special logic */}
                      {(subscription?.hasWeeklySubscription || subscription?.hasExtendedSubscription || (!subscription?.hasWeeklySubscription && !subscription?.hasExtendedSubscription && subscription?.specialKeyAccess)) && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900">
                          <div className="flex-shrink-0 p-2 rounded-full bg-green-100 dark:bg-green-800">
                            <Clock className="w-5 h-5 text-green-600 dark:text-green-300" />
                          </div>

                          <div className="flex flex-col text-sm">
                            <span className="text-xs font-semibold text-green-800 dark:text-green-200">
                              {subscription?.specialKeyAccess 
                                ? "Special Weekly Plan"
                                : (
                                  <>
                                    {subscription?.hasExtendedSubscription && <span>Extended </span>}
                                    Weekly Plan
                                  </>
                                )}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              Valid until <strong>{new Date(subscription.weeklyExpiresAt).toLocaleDateString()}</strong>
                            </span>
                          </div>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}





              </div>
            )}
          </motion.div>
        );
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      {/* Emotional State Modal */}
      <AnimatePresence>
        {showEmotionalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-xl font-semibold mb-4 text-center">How are you feeling?</h3>
              <EmotionalSlider
                value={wellbeingScore || 5}
                onChange={setWellbeingScore}
                label="Rate your current emotional state"
              />
              <div className="mt-6 space-y-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowEmotionalModal(false);
                    handleFindMatch();
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md"
                >
                  Continue
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowEmotionalModal(false)}
                  className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="pb-20">
        {renderContent()}
      </div>
        
      {/* Bottom Navigation */}
     <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg">
  <div className="max-w-6xl mx-auto px-4">
    <div className="flex justify-around py-3">
      {[
        { id: 'home', icon: Heart, label: 'Home' },
        { id: 'history', icon: HistoryIcon, label: 'History' },
        { id: 'admin', icon: ChartBar, label: 'Admin' },
        { id: 'settings', icon: SettingsIcon, label: 'Settings' },
      ]
        .filter(item => {
          if (item.id === 'history' && currentRole === 'admin') return false;
          if (item.id === 'admin' && currentRole !== 'admin') return false;
          return true;
        })
        .map(({ id, icon: Icon, label }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleTabChange(id)}
            disabled={isLoggingOut}
            className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === id
                ? 'text-purple-500 bg-purple-50 dark:bg-gray-700'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            } ${isLoggingOut ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </motion.button>
        ))}
    </div>
  </div>
</nav>

  
      {/* Video Session Modal */}
      <AnimatePresence>
        {showVideoSession && (
          <VideoSession onClose={handleCloseSession} />
        )}
      </AnimatePresence>

      {/* Match Found Modal */}
      <AnimatePresence>
        {matchedUser && !showVideoSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                  <Star className="w-8 h-8 text-green-500 dark:text-green-300" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Match Found!</h3>
              </div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative">
                  <img
                    src={matchedUser.avatar_url || 'https://via.placeholder.com/64'}
                    alt={matchedUser.username}
                    className="w-16 h-16 rounded-full border-2 border-white shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <p className="font-semibold">{matchedUser.username}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{matchedUser.bio}</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowVideoSession(true)}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md"
                >
                  Start Session
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const cancelToastId = toast.loading("Canceling match...");
                    cancelMatch().then(() => {
                      toast.success("Match canceled", { id: cancelToastId });
                    }).catch(() => {
                      toast.error("Failed to cancel match", { id: cancelToastId });
                    });
                  }}
                  className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Subscribe Prompt Modal */}
      <AnimatePresence>
        {showSubscribePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="inline-flex p-3 rounded-full bg-orange-100 dark:bg-orange-900 mb-4">
                  <AlertCircle className="w-8 h-8 text-orange-500 dark:text-orange-300" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Available Sessions</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  You need to subscribe or purchase session credits to continue.
                </p>
              </div>

              <div className="space-y-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowSubscribePrompt(false);
                    handleTabChange('settings');
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md"
                >
                  View Subscription Options


                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSubscribePrompt(false)}
                  className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isLoggingOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center"
            >
              <Loader className="w-12 h-12 animate-spin text-purple-500 mb-4" />
              <p className="text-lg font-semibold text-center">Logging out...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                Please wait while we securely log you out
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;