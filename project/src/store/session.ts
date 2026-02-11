import { create } from 'zustand';
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
  _id?: string;
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
  _id?: string;
  id?: string;
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
  startSession: () => Promise<'matched' | 'waiting'>;
  /** Called when match is found via polling (matchFound event). Creates session and updates store. */
  completeSessionWithMatch: (match: MatchedUser) => Promise<void>;
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
      const response = await fetch(`http://localhost:4000/api/subscriptions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials:'include'
      });

      if (!response.ok) throw new Error('Failed to fetch subscription');

      const data = await response.json();
      // console.log('dataaaaaaaaaaaaaa',data)

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
  
  startSession: async (): Promise<'matched' | 'waiting'> => {
    const role = get().currentRole;
    if (!role || role === "admin") {
      toast.error("Invalid role");
      return "matched";
    }

    set({ isSearching: true });

    try {
      const meRes = await fetch("http://localhost:4000/api/user/me", {
        credentials: "include",
      });
      if (!meRes.ok) throw new Error("Auth failed");

      const me = await meRes.json();

      await cleanupPresence();
      await new Promise((r) => setTimeout(r, 400));

      const match = await findMatch(role);
      if (!match) {
        return "waiting";
      }

      set({ matchedUser: match });

      const heroId = role === "hero" ? me.id : match.matched_user_id;
      const uplifterId = role === "uplifter" ? me.id : match.matched_user_id;

      const res = await fetch("http://localhost:4000/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId,
          uplifterId,
          paymentStatus: "free",
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const data = await res.json();
      const session = data.session ?? data;

      set({
        currentSession: session,
        isActive: true,
        isSearching: false,
      });

      toast.success("Session started 🎉");
      return "matched";
    } catch (error) {
      console.error(error);
      toast.error("Failed to start session");
      set({ isSearching: false });
      return "matched";
    }
  },

  completeSessionWithMatch: async (match: MatchedUser) => {
    const role = get().currentRole;
    if (!role || role === "admin") return;

    try {
      const meRes = await fetch("http://localhost:4000/api/user/me", {
        credentials: "include",
      });
      if (!meRes.ok) throw new Error("Auth failed");
      const me = await meRes.json();

      set({ matchedUser: match });

      const heroId = role === "hero" ? me.id : match.matched_user_id;
      const uplifterId = role === "uplifter" ? me.id : match.matched_user_id;

      const res = await fetch("http://localhost:4000/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId,
          uplifterId,
          paymentStatus: "free",
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      const session = data.session ?? data;

      set({
        currentSession: session,
        isActive: true,
        isSearching: false,
      });
      toast.success("Match found! Session started 🎉");
    } catch (error) {
      console.error(error);
      toast.error("Failed to start session");
      set({ isSearching: false });
    }
  },

  /* -------- VIDEO CALL (ID BUG FIXED) -------- */
  initializeVideoCall: async (container: HTMLElement) => {
    const session = get().currentSession;
    const sessionId = session?.id || session?._id;

    if (!sessionId) throw new Error("No active session");

    await initializeLocalVideo(container);
    const client = await initializeDaily(container, sessionId);

    set({ videoClient: client });
    return client;
  },


  /* -------- END SESSION (CONTROLLER-SAFE) -------- */
  endSession: async (rating?: number) => {
    const { currentSession, videoClient } = get();
    const sessionId = currentSession?.id || currentSession?._id;

    if (!sessionId) return;

    if (videoClient) await cleanupDaily();
    await cleanupPresence();

    await fetch(`http://localhost:4000/api/sessions/${sessionId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endTime: new Date().toISOString(),
        ratingGiven: rating,
      }),
    });

    set({
      isActive: false,
      currentSession: null,
      matchedUser: null,
      videoClient: null,
    });
  },


  /* -------- CANCEL MATCH (OLD BEHAVIOR) -------- */
  cancelMatch: async () => {
    await cleanupPresence();
    await cleanupDaily();

    set({
      isActive: false,
      isSearching: false,
      currentSession: null,
      matchedUser: null,
      videoClient: null,
    });

    toast.info("Match cancelled");
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
      set({profilePicture: data.profile?.avatar || ''}) 
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
      // console.log(data.subscription);
      
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