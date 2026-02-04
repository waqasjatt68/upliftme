import React, { useState, useEffect } from "react";
import { Moon, Sun, Loader, Subscript } from "lucide-react";
import WelcomeScreen from "./components/WelcomeScreen";
import Dashboard from "./components/Dashboard";
import { useNavigate } from "react-router-dom";
import Subscription from "./components/Subscription";

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const toggleSubscription = () => {
    setIsSubscribed(!isSubscribed);
    if (!isSubscribed) {
      // Simulate subscription logic
      setTimeout(() => {
        setIsSubscribed(true)
      }, 500);
    }
    else {
      // Simulate unsubscription logic
      setTimeout(() => {
        setIsSubscribed(false);
      }, 500);
    }
  }



  // Simulate onboarding loading
  useEffect(() => {
    if (isOnboarded) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        navigate("/");
        setIsLoading(false);
      }, 1000); // simulate navigation delay

      return () => clearTimeout(timer);
    }
  }, [isOnboarded, navigate]);

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader className="w-12 h-12 text-purple-500 animate-spin" />
            <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
          </div>
        ) : !isOnboarded ? (
          <WelcomeScreen
            onComplete={() => {
              setIsLoading(true);
              setTimeout(() => {
                setIsOnboarded(true);
                setIsLoading(false);
              }, 800); // simulate delay
            }}
          />
        ) :
          <>
            {
              isSubscribed ?
                <Dashboard />
                : <Subscription />
            }


          </>
        }
        {
          isOnboarded && (<>
            {isSubscribed && (<button
              onClick={toggleSubscription}
              className="fixed bottom-24 right-20 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-200"
              aria-label="Subscribe"
            >
              Subscribe
            </button>)}
            {!isSubscribed && (<button
              onClick={toggleSubscription}
              className="fixed top-8 left-6 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-200"
              aria-label="Subscribe"
            >
              Back

            </button>)}

          </>)
        }


        <button
          onClick={toggleDarkMode}
          className="fixed bottom-24 right-6 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? (
            <Sun className="w-7 h-7 text-yellow-500" />
          ) : (
            <Moon className="w-7 h-7 text-gray-700" />
          )}
        </button>
      </div>
    </div>
  );
};

export default App;
