import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { findMatch, MatchedUser, cleanupPresence } from '../lib/matching';
import { initializeDaily, cleanupDaily, initializeLocalVideo } from '../lib/daily';
import { toast } from 'sonner';
// import socket from '../lib/socket';

// Use a constant for the API base URL
// const API_BASE_URL = import.meta.env.VITE_SERVER_URI || "https://www.upliftmee.com";

// Define proper types for user stats
// interface UserStats {
//   sessions: any[];
//   totalHeroDuration: number;
//   totalSessions: number;
//   averageFinalMood: number;
// }

// Define a proper type for the session
interface Session {
  id: string;
  hero_id: string;
  uplifter_id: string;
  status: 'active' | 'completed';
  started_at: string;
  ended_at?: string;
  rating?: number;
  uplifter?: {
    username: string;
  };
  payment_intent_id?: string;
  amount_paid?: number;
  uplifter_earnings?: number;
  platform_fee?: number;
}

// Define a proper type for payment
interface PaymentInfo {
  payment_intent_id?: string;
  amount_paid?: number;
  uplifter_earnings?: number;
  platform_fee?: number;
}
export type Role = 'hero' | 'uplifter' | 'admin';

interface SessionState {
  isActive: boolean;
  timeRemaining: number;
  userStats: any[] | null;
  loadingHistory: boolean;
  currentSession: Session | null;
  matchedUser: MatchedUser | null;
  isSearching: boolean;
  currentRole: Role | null;
  rating: number;
  totalHeroDuration: number;
  dbId: string;
  userStatus: string;
  userName:string;
  profilePicture:string
  averageHeroRating: number;
  totalHeroSessionsTaken: number;
  totalUplifterDuration: number;
  totalUplifterSessionsTaken: number;
  averageUplifterRating: number;
  hasSubscription: boolean;
  sessionCredits: number;
  isDevelopment: boolean;
  videoClient: any | null;
  // hasWeeklySubscription:boolean;
  // sessionBalance:number;
  // hasExtendedSubscription :boolean;
  subscription: {
    hasWeeklySubscription: boolean;
    hasExtendedSubscription: boolean;
    sessionBalance: number;
    specialKeyAccess:boolean; 
    purchasedBundles: any[]|null;
    weeklyExpiresAt:any|null;
  };
  // startSession: (role: 'hero' | 'uplifter') => Promise<void>;
  startSession: () => Promise<void>;
  endSession: (rating?: number, payment?: PaymentInfo) => Promise<void>;
  cancelMatch: () => Promise<void>;
  initializeVideoCall: (container: HTMLElement) => Promise<any>;
  switchRole: () => Promise<void>;
  loadCurrentRole: () => Promise<void>;
  fetchUserStats: () => Promise<void>;
  fetchUserStats2: () => Promise<void>;
  checkSessionAvailability: () => Promise<{ canStart: boolean; reason?: string }>;
  loadUserSubscription: () => Promise<void>;
  toggleDevelopmentMode: () => void;
  
}

// Create the store with proper typing
const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  timeRemaining: 7 * 60,
  userStats: null,
  currentSession: null,
  matchedUser: null,
  isSearching: false,
  currentRole: null,
  totalHeroDuration: 0,
  rating: 0,
  userStatus: '',
  dbId: '',
  loadingHistory: false,
  userName: '',
  profilePicture:'',
  averageHeroRating: 0, // Fixed typo in property name
  totalHeroSessionsTaken: 0,
  totalUplifterDuration: 0,
  totalUplifterSessionsTaken: 0,
  averageUplifterRating: 0,
  hasSubscription: false,
  sessionCredits: 0,
  isDevelopment: false,
  videoClient: null,
  // hasWeeklySubscription:false,
  // sessionBalance:0,
  // hasExtendedSubscription :false,
  subscription: {
    hasWeeklySubscription: false,
    hasExtendedSubscription: false,
    sessionBalance: 0,
    specialKeyAccess :false,
    weeklyExpiresAt:null,
    purchasedBundles: null,
  },
  toggleDevelopmentMode: () => {
    set(state => ({
      isDevelopment: !state.isDevelopment,
      hasSubscription: !state.isDevelopment,
      sessionCredits: !state.isDevelopment ? 999 : 0
    }));
  },
  

  loadUserSubscription: async () => {
    const { isDevelopment } = get();
    if (isDevelopment) {
      set({ hasSubscription: true, sessionCredits: 999 });
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/session-availability`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subscription');

      const data = await response.json();

      // Update store with correct subscription info
      set({
        hasSubscription: data.canStart,
        sessionCredits: data.sessionBalance || 0,
        subscription: {
          ...get().subscription,
          sessionBalance: data.sessionBalance || 0,
          hasWeeklySubscription: data.hasWeeklySubscription || false,
          hasExtendedSubscription: data.hasExtendedSubscription || false,
          specialKeyAccess: data.specialKeyAccess || false,
          purchasedBundles: data.purchasedBundles || null,
          weeklyExpiresAt: data.weeklyExpiresAt || null,
        }
      });

    } catch (err) {
      console.error('Failed to load subscription:', err);
      set({ hasSubscription: false, sessionCredits: 0 });
    }
  },

  checkSessionAvailability: async () => {
    const { isDevelopment, subscription } = get();

    if (isDevelopment) {
      return { canStart: true, reason: 'development' };
    }

    // Use the latest subscription info from store
    if (subscription.sessionBalance > 0 || subscription.hasWeeklySubscription || subscription.hasExtendedSubscription) {
      return { canStart: true, reason: 'active_subscription' };
    }

    return { canStart: false, reason: 'no_subscription' };
  },
  
  startSession: async () => {
    const role = get().currentRole;

    if (!role || (role !== 'hero' && role !== 'uplifter')) {
      toast.error('Invalid role. Please select hero or uplifter.');
      return;
    }

    set({ isSearching: true });

    try {
      // 1️⃣ Get current user
      const res = await fetch("/api/user/me", { credentials: "include" });
    if (!res.ok) throw new Error("Not authenticated");
    const user = await res.json();

      // 4️⃣ Cleanup any previous presence
      await cleanupPresence();

      // 5️⃣ Wait a short delay to ensure presence is registered
      await new Promise(res => setTimeout(res, 500));

      // 6️⃣ Retry findMatch for up to 10 seconds
      let match: MatchedUser | null = null;
      const startTime = Date.now();
      const timeout = 10000; // 10s
      const retryDelay = 500; // 0.5s

      while (!match && Date.now() - startTime < timeout) {
        match = await findMatch(role);
        if (!match) await new Promise(res => setTimeout(res, retryDelay));
      }

      if (!match) {
        toast.error('Failed to find a match. Please try again.');
        set({ isSearching: false });
        return;
      }

      // 7️⃣ Handle match found
      await handleMatchFound(match);

    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start session. Please try again.');
      set({ isSearching: false });
    }

    // ----- Inner function for handling the match -----
    async function handleMatchFound(match: MatchedUser) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      set({ matchedUser: match });

      // Create session record in Supabase
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          hero_id: role === 'hero' ? user.id : match.matched_user_id,
          uplifter_id: role === 'uplifter' ? user.id : match.matched_user_id,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select('*, uplifter:uplifter_id(username)')
        .single();

      if (sessionError) throw sessionError;

      toast.success('Match found! Starting session...', { duration: 5000 });

      set({
        isActive: true,
        timeRemaining: 7 * 60, // 7 minutes
        currentSession: session,
        isSearching: false,
      });
    }
  },


  initializeVideoCall: async (container: HTMLElement) => {
    const { currentSession } = get();
    if (!currentSession?.id) {
      throw new Error('No session available');
    }

    try {
      // console.log('🎥 Initializing video call for session:', currentSession.id);

      // First initialize local video preview with a timeout
      const localVideoPromise = initializeLocalVideo(container);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Local video initialization timed out')), 15000)
      );

      await Promise.race([localVideoPromise, timeoutPromise]);
      // console.log('✅ Local video initialized');

      // Then initialize the full video call with a timeout
      const dailyPromise = initializeDaily(container, currentSession.id);
      const dailyTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Daily call initialization timed out')), 15000)
      );

      const client = await Promise.race([dailyPromise, dailyTimeoutPromise]);
      // console.log('✅ Daily call initialized');

      set({ videoClient: client });
      return client;
    } catch (error) {
      console.error('Failed to initialize video call:', error);
      toast.error('Failed to start video call. Please try refreshing.');
      throw error;
    }
  },

  endSession: async (rating?: number, payment?: PaymentInfo) => {
    const { currentSession, videoClient } = get();
    if (!currentSession) return;

    try {
      // console.log('🔄 Ending session:', currentSession.id);

      // Run cleanup operations in parallel for better performance
      const cleanupPromises = [];

      // Clean up video call
      if (videoClient) {
        cleanupPromises.push(cleanupDaily());
      }

      // Clean up presence
      cleanupPromises.push(cleanupPresence());

      // Wait for all cleanup operations to complete
      await Promise.all(cleanupPromises);

      // Update session record
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          rating,
          payment_intent_id: payment?.payment_intent_id,
          amount_paid: payment?.amount_paid,
          uplifter_earnings: payment?.uplifter_earnings,
          platform_fee: payment?.platform_fee
        })
        .eq('id', currentSession.id);

      if (updateError) throw updateError;

      // console.log('✅ Session ended successfully');

      // Reset state but keep current role
      const currentRole = get().currentRole;
      set({
        isActive: false,
        timeRemaining: 0,
        currentSession: null,
        matchedUser: null,
        isSearching: false,
        currentRole,
        videoClient: null
      });
    } catch (error) {
      console.error('Failed to end session:', error);
      // Still attempt to reset state even if update fails
      const currentRole = get().currentRole;
      set({
        isActive: false,
        timeRemaining: 0,
        currentSession: null,
        matchedUser: null,
        isSearching: false,
        currentRole,
        videoClient: null
      });
      throw error;
    }
  },

  cancelMatch: async () => {
    try {
      // console.log('🔄 Canceling match...');

      // Run cleanup operations in parallel for better performance
      await Promise.all([
        cleanupPresence(),
        Promise.resolve(cleanupDaily())
      ]);

      // console.log('✅ Match canceled successfully');
      toast.info('Match canceled');

      // Reset state but keep current role
      const currentRole = get().currentRole;
      set({
        isActive: false,
        timeRemaining: 0,
        currentSession: null,
        matchedUser: null,
        isSearching: false,
        currentRole,
        videoClient: null
      });
    } catch (error) {
      console.error('Failed to cancel match:', error);
      // Still reset state even if cleanup fails
      const currentRole = get().currentRole;
      set({
        isActive: false,
        timeRemaining: 0,
        currentSession: null,
        matchedUser: null,
        isSearching: false,
        currentRole,
        videoClient: null
      });
    }
  },

  switchRole: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`http://localhost:4000/api/user/toggleUserRole`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // if (!response.ok) {
      //   throw new Error(data.message || "Failed to toggle role");
      // }
      // console.log(response);
      
      if (!response.ok) {
        const message = response?.statusText || 'Unknown error';
        if (message.includes('No token provided') || message.includes('Unauthorized')) {
          console.warn('Token missing or user not authenticated');
          // You can redirect to login, show a modal, or just stop further processing
          localStorage.clear();
          window.location.reload();
          return;
        }
        throw new Error(message);
      }

      set({ currentRole: data.role });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Role toggle request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.error('Failed to switch role:', error);
        toast.error('Failed to change role. Please try again.');
      }
      throw error;
    }
  },

  loadCurrentRole: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`http://localhost:4000/api/user/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const message = response?.statusText || 'Unknown error';
        if (message.includes('No token provided') || message.includes('Unauthorized')) {
          console.warn('Token missing or user not authenticated');
          // You can redirect to login, show a modal, or just stop further processing
          localStorage.clear();
          window.location.reload();
          return;
        }
        throw new Error(message);
      }
      
      const data = await response.json();
      
      // console.log('User data:', data.ratings);


      if (!data) {
        throw new Error('No user data received');
      }
      
      set({ dbId: data.id });
      set({profilePicture:data.avatar || ''})
      // Register user with socket only if we have valid data
      if (data.username && data.id) {
        // socket.emit("registerUser", {
        //   username: data.username,
        //   dbid: data.id,
        //   role: data.role,
        //   rating: data.ratings,

        // });
       set({userName:data.username})

        localStorage.setItem("role", data.role)
        localStorage.setItem("username", data.username)
        localStorage.setItem("dbId",data.id)
      }

      if (data?.role) {
        
        set({ currentRole: data.role as 'hero' | 'uplifter' | 'admin' });
        set({ userStatus: data.status});
        set({ rating: data.ratings });
      }
    } catch (error) {
      localStorage.clear();
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Role loading request timed out');
        window.location.reload();
      } else {
        console.error('Failed to load current role:', error);
        window.location.reload();
      }
      // Don't set any state on error to avoid overwriting existing role
    }
  },

  fetchUserStats: async () => {
    try {
      set({ loadingHistory: true }); // Show loading indicator
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 10 second timeout

      const response = await fetch(`http://localhost:4000/api/user/stats`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const message = response?.statusText || 'Unknown error';
        if (message.includes('No token provided') || message.includes('Unauthorized')) {
          console.warn('Token missing or user not authenticated');
          // You can redirect to login, show a modal, or just stop further processing
          localStorage.clear();
          window.location.reload();
          return;
        }
        throw new Error(message);
      }

      const data = await response.json();
      // console.log('User stats:', data);

      if (!data || !data.stats) {
        throw new Error("Invalid stats data received");
      }

      // console.log(data);
      
      // Update all stats at once to reduce state updates
      set({
        userStats: data.stats.sessions || [],
        currentRole: data.stats.role,
      });
      set({ loadingHistory: false });
      // console.log(data.profile.avatar);
      
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Stats fetching request timed out');
      } else {
        console.error('Failed to fetch user stats:', error);
      }
      // Don't set any state on error to avoid overwriting existing stats
    }
  },

  fetchUserStats2: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 10 second timeout

      const response = await fetch(`http://localhost:4000/api/user/stats2`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const message = response?.statusText || 'Unknown error';
        if (message.includes('No token provided') || message.includes('Unauthorized')) {
          console.warn('Token missing or user not authenticated');
          // You can redirect to login, show a modal, or just stop further processing
          localStorage.clear();
          window.location.reload();
          return;
        }
        throw new Error(message);
      }

      const data = await response.json();
      // console.log('User stats:', data);

      if (!data || !data.stats) {
        throw new Error("Invalid stats data received");
      }
      console.log(data.subscription);
      
      data.subscription.specialKeyAccess=true;
      data.subscription.hasExtendedSubscription=false;
      data.subscription.hasWeeklySubscription=false;
      // Update all stats at once to reduce state updates
      set({
        // userStats: data.stats.sessions || [],
        totalHeroDuration: data.stats.heroStats.totalDuration || 0,
        totalHeroSessionsTaken: data.stats.heroStats.totalSessions || 0,
        averageHeroRating: data.stats.heroStats.averageFinalMood || 0,
        totalUplifterDuration: data.stats.uplifterStats.totalDuration || 0,
        totalUplifterSessionsTaken: data.stats.uplifterStats.totalSessions || 0,
        averageUplifterRating: data.stats.uplifterStats.averageFinalMood || 0,
        subscription: data.subscription,

      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Stats fetching request timed out');
      } else {
        console.error('Failed to fetch user stats:', error);
      }
      // Don't set any state on error to avoid overwriting existing stats
    }
  }
}));




export { useSessionStore };