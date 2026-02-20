import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketProvider";

// API base URL from environment
const API_BASE_URL = import.meta.env.VITE_SERVER_URI || "https://www.upliftmee.com";

interface AuthProps {
  onSuccess: (isNewUser: boolean) => void;
  initialLoginMode?: boolean;
}


const Auth: React.FC<AuthProps> = ({ onSuccess, initialLoginMode = false }) => {
  const socket = useSocket();
  const [isSignUp, setIsSignUp] = useState(!initialLoginMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room] = useState<string>("1");
  const navigate = useNavigate();
  
  useEffect(() => {
   
    const handleAuthCheck = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/user/me", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
    
        const data = await response.json();
    
        if (!response.ok) {
          const message =
            data?.message || response?.statusText || 'Unknown error';
    
          if (message.includes('No token provided') || message.includes('Unauthorized')) {
            console.warn('Login required');
            // Soft fail: no error thrown, no reload
            return;
          }
    
          // If other types of error
          throw new Error(message);
        }
    
        if (data?.username) {
          if (data?.email) {
            socket.emit("room:join", { email: data.email, room });
            
            localStorage.setItem("role", data.role);
            localStorage.setItem("username", data.username);
            localStorage.setItem("subscription_Status", "20");
          }
          
          
            onSuccess(false); // User exists but needs profile
          
        } else if (data?.id) {
          onSuccess(true); // User exists but needs profile
        }
    
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        
        if (
          message.includes('No token provided') ||
          message.includes('Unauthorized')
        ) {
          console.warn('Login required'); // Suppress full error
        } else {
          setError(message);
          console.error("Auth check failed:", message);
        }
    
        localStorage.clear();
        // Optionally skip reload to avoid interruption
        // window.location.reload();
      } finally {
        setAuthCheckLoading(false);
      }
    };

    
    handleAuthCheck();
  }, [onSuccess, socket, room]);

  // Handle room joining
  useEffect(() => {
    const handleJoinRoom = (data: { email: string; room: string }) => {
      const { room } = data;
      navigate(`/room/${room}`);
    };

    socket.on("room:join", handleJoinRoom);
    return () => {
      socket.off("room:join", handleJoinRoom);
    };
  }, [socket, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
          // Register User
          const response = await fetch("http://localhost:4000/api/user/createAccount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          // credentials: "include"
        });

        const data = await response.json();
  

        if (!response.ok) {
          if (data.message?.includes("already exists")) {
            // If user exists, switch to login mode and attempt login
            setIsSignUp(false);
            return handleLogin();
          }
          throw new Error(data.message || "Registration failed");
        }
        return handleLogin(); // New user
      } else {
        await handleLogin();
        // onSuccess() in WelcomeScreen will call onComplete() and show Dashboard — no redirect needed
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setPassword(""); // Clear password field for security
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogin = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Invalid email or password");
      }

      
      if (data?.data?.username) {
        onSuccess(false); // User exists with profile
    
      } else if (data?.id) {
        onSuccess(true); // User exists but needs profile
      } else {
        throw new Error("User login failed or invalid response");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setPassword(""); // Clear password field for security
    }
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setPassword('');
  };

  // Show loading spinner during initial auth check
  if (authCheckLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full py-12">
        <Loader className="w-8 h-8 text-purple-500 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-300">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {isSignUp ? `Start your journey with UpliftMe` : `Continue your journey of making a difference`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              minLength={6}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              disabled={loading}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {isSignUp ? 'Password must be at least 6 characters long' : ''}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center"
        >
          {loading ? (
            <>
              <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            isSignUp ? 'Create Account' : 'Sign In'
          )}
        </button>
      </form>

      <div className="text-center">
        <button
          onClick={handleToggleMode}
          className="text-purple-500 hover:text-purple-600 font-medium"
          disabled={loading}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
};

export default Auth;