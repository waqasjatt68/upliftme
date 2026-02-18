// import { supabase } from "./supabase";
// import { toast } from "sonner";

// export interface MatchedUser {
//   matched_user_id: string;
//   match_score: number;
//   username: string;
//   avatar_url: string;
//   bio: string;
// }

// interface MatchRow {
//   matched_user_id: string;
//   match_score: number;
//   username: string;
// }

// // Keep track of polling interval
// let matchPollingInterval: NodeJS.Timeout | null = null;

// // Enhanced logging for matching operations
// const logMatchingEvent = async (event: string, details: any) => {
//   try {
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();
//     if (!user) return;

//     await supabase.from("matching_presence_logs").insert({
//       event_type: `matching_${event}`,
//       user_id: user.id,
//       details: {
//         timestamp: new Date().toISOString(),
//         ...details,
//       },
//     });

//     console.log(`🔄 Matching Event [${event}]:`, details);
//   } catch (error) {
//     console.error("Failed to log matching event:", error);
//   }
// };

// export async function findMatch(
//   role: "hero" | "uplifter",
// ): Promise<MatchedUser | null> {
//   try {
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();
//     if (!user) throw new Error("Not authenticated");

//     await logMatchingEvent("search_start", {
//       role,
//       userId: user.id,
//     });

//     // First ensure user's role is set in users table
//     const { error: roleError } = await supabase
//       .from("users")
//       .update({ role })
//       .eq("id", user.id);

//     if (roleError) {
//       await logMatchingEvent("role_update_error", { error: roleError });
//       throw roleError;
//     }

//         // ✅ Register user as searching
//     const { error: presenceError } = await supabase
//       .from("matching_presence")
//       .upsert({
//         user_id: user.id,
//         role,
//         status: "searching",
//         last_seen: new Date().toISOString(),
//       });

//     if (presenceError) {
//       await logMatchingEvent("presence_insert_error", { error: presenceError });
//       throw presenceError;
//     }


//     // Clean up any existing presence
//     // await cleanupPresence();

//     // // Add a delay to ensure cleanup is complete
//     // await new Promise((resolve) => setTimeout(resolve, 1000));

//     await logMatchingEvent("presence_cleanup_complete", {
//       userId: user.id,
//     });

//     // Call the Supabase function to find a match
//     const { data, error: matchError } = await supabase.rpc(
//       "find_active_match",
//       { search_user_id: user.id, search_role: role }
//     );

//     const matches = data as MatchRow[] | null;


//     if (matchError) {
//       await logMatchingEvent("match_query_error", { error: matchError });
//       throw matchError;
//     }

//     await logMatchingEvent("potential_matches", {
//       count: matches?.length || 0,
//       matches: matches?.map((m) => ({
//         id: m.matched_user_id,
//         username: m.username,
//         score: m.match_score,
//       })),
//     });

//     if (!matches || matches.length === 0) {
//       await logMatchingEvent("no_immediate_match", {
//         userId: user.id,
//         role,
//       });
//       startPolling(user.id, role);
//       return null;
//     }

//     const match = matches[0];
//     if (!match) return null;

//     // Double-check match is still available
//     const { data: matchPresence } = await supabase
//       .from("matching_presence")
//       .select("status, role")
//       .eq("user_id", match.matched_user_id)
//       .single();

//     if (!matchPresence || matchPresence.status !== "searching") {
//       await logMatchingEvent("match_no_longer_available", {
//         matchId: match.matched_user_id,
//         status: matchPresence?.status,
//         role: matchPresence?.role,
//       });
//       return null;
//     }

//     await logMatchingEvent("match_established", {
//       user1: {
//         id: user.id,
//         role: role,
//       },
//       user2: {
//         id: match.matched_user_id,
//         username: match.username,
//         role: matchPresence.role,
//       },
//     });

//     stopPolling();
//     return match;
//   } catch (error) {
//     const message =
//       error instanceof Error ? error.message : "Unknown error";

//     await logMatchingEvent("error", { error: message });
//   }

//     await cleanupPresence();
//     stopPolling();
//     toast.error("Failed to find match. Please try again.");
//     return null;
//   }
// }

// function startPolling(userId: string, role: string) {
//   stopPolling();

//   console.log("⏱️ Starting match polling:", {
//     userId,
//     role,
//     timestamp: new Date().toISOString(),
//   });

//   matchPollingInterval = setInterval(async () => {
//     try {
//       // Call the Supabase function to find a match
//       const { data: matches, error: matchError } = await supabase.rpc(
//         "find_active_match",
//         {
//           search_user_id: userId,
//           search_role: role,
//         },
//       );

//       if (matchError) throw matchError;

//       if (matches && matches.length > 0) {
//         const match = matches[0];

//         // Double-check match is still available
//         const { data: matchPresence } = await supabase
//           .from("matching_presence")
//           .select("status, role")
//           .eq("user_id", match.matched_user_id)
//           .single();

//         if (!matchPresence || matchPresence.status !== "searching") {
//           await logMatchingEvent("polling_match_unavailable", {
//             matchId: match.matched_user_id,
//             status: matchPresence?.status,
//           });
//           return;
//         }

//         await logMatchingEvent("polling_match_found", {
//           matchId: match.matched_user_id,
//           username: match.username,
//         });

//         // Trigger match found event
//         const event = new CustomEvent("matchFound", {
//           detail: match,
//         });
//         window.dispatchEvent(event);
//         stopPolling();
//       }
//     } catch (error) {
//       await logMatchingEvent("polling_error", { error: error.message });
//     }
//   }, 2000);
// }

// function stopPolling() {
//   if (matchPollingInterval) {
//     clearInterval(matchPollingInterval);
//     matchPollingInterval = null;
//     console.log("⏹️ Stopped match polling:", {
//       timestamp: new Date().toISOString(),
//     });
//   }
// }

// export async function cleanupPresence() {
//   try {
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();
//     if (!user) return;

//     await logMatchingEvent("cleanup_start", {
//       userId: user.id,
//     });

//     // Delete existing presence record
//     const { error } = await supabase
//       .from("matching_presence")
//       .delete()
//       .eq("user_id", user.id);

//     if (error) {
//       await logMatchingEvent("cleanup_error", { error: error.message });
//       throw error;
//     }

//     await logMatchingEvent("cleanup_complete", {
//       userId: user.id,
//     });
//   } catch (error) {
//     await logMatchingEvent("cleanup_error", { error: error.message });
//   }
// }


import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_SERVER_URI || "http://localhost:4000";

/* ===================== TYPES ===================== */

export interface MatchedUser {
  matched_user_id: string;
  match_score: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role?: string;
}

/* ===================== POLLING ===================== */

let pollingInterval: ReturnType<typeof setInterval> | null = null;

/* ===================== LOGGER ===================== */

async function logMatchingEvent(
  event: string,
  details: Record<string, unknown>
) {
  try {
    await fetch(`${API_BASE}/api/matching/log-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ event, metadata: details }),
    });
  } catch {
    // intentionally silent
  }
}

/* ===================== MATCH FINDER ===================== */

// export async function findMatch(
//   role: "hero" | "uplifter"
// ): Promise<MatchedUser | null> {
//   console.log("[findMatch] called", { role });
//   try {
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();

//     if (!user) {
//       console.warn("[findMatch] no user – not authenticated");
//       throw new Error("User not authenticated");
//     }
//     console.log("[findMatch] user ok", { userId: user.id });

//     await logMatchingEvent("search_start", { role });
//     await cleanupPresence();
//     console.log("[findMatch] cleanupPresence done, calling RPC find_active_match");

//     const { data, error } = await supabase.rpc("find_active_match", {
//       search_user_id: user.id,
//       search_role: role,
//     });

//     if (error) {
//       console.error("[findMatch] RPC find_active_match error", {
//         message: error.message,
//         code: error.code,
//         details: error.details,
//       });
//       throw error;
//     }

//     const matches = data as MatchRPCRow[] | null;
//     const count = Array.isArray(matches) ? matches.length : matches == null ? 0 : "not-array";
//     console.log("[findMatch] RPC result", { rawData: data, matchCount: count });

//     if (!matches || matches.length === 0) {
//       console.log("[findMatch] no matches – starting polling, returning null");
//       startPolling(user.id, role);
//       return null;
//     }

//     const match = matches[0];
//     console.log("[findMatch] match found", {
//       matched_user_id: match.matched_user_id,
//       username: match.username,
//       score: match.match_score,
//     });

//     await logMatchingEvent("match_found", {
//       matched_user_id: match.matched_user_id,
//       score: match.match_score,
//     });

//     stopPolling();
//     return match;
//   } catch (err) {
//     const message =
//       err instanceof Error ? err.message : "Unknown matching error";
//     console.error("[findMatch] catch – returning null", { error: err, message });

//     await logMatchingEvent("error", { error: message });
//     await cleanupPresence();
//     stopPolling();
//     toast.error("Failed to find match");

//     return null;
//   }
// }

export async function findMatch(
  role: "hero" | "uplifter"
): Promise<MatchedUser | null> {
  console.log("[findMatch] 🔍 Starting match search", { role });
  
  try {
    // 1️⃣ Verify authentication with YOUR backend (not Supabase!)
    const userRes = await fetch(`${API_BASE}/api/user/me`, { 
      credentials: "include" 
    });

    if (!userRes.ok) {
      console.error("[findMatch] ❌ User not authenticated");
      throw new Error("User not authenticated");
    }

    const user = await userRes.json();
    // Backend /api/user/me returns "username" (lowercase), not "userName"
    const rawUserId = user.id ?? user._id;
    const userId =
      rawUserId == null
        ? ""
        : typeof rawUserId === "string"
          ? rawUserId
          : (rawUserId as { toString?: () => string }).toString?.() ?? String(rawUserId);
    const userName = (user.userName ?? user.username ?? "").trim();
    console.log("[findMatch] ✅ User authenticated", { userId, userName });

    if (!userId || !userName) {
      console.error("[findMatch] ❌ User profile missing id or username", user);
      throw new Error("User profile incomplete. Please refresh and try again.");
    }

    // 2️⃣ Log matching event
    await logMatchingEvent("search_start", { role });

    // 3️⃣ Cleanup previous presence
    await cleanupPresence();
    console.log("[findMatch] 🧹 Cleanup done");

    // 4️⃣ Call YOUR backend to find a match (not Supabase RPC!)
    console.log("[findMatch] 🔎 Calling backend find_match API...");
    
    const matchRes = await fetch(`${API_BASE}/api/matching/find-match`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        userId,
        userName,
        role,
      }),
    });

    if (!matchRes.ok) {
      const error = await matchRes.json();
      console.error("[findMatch] ❌ Backend error:", error);
      throw new Error(error.message || "Failed to find match");
    }

    const data = await matchRes.json();
    console.log("[findMatch] 📡 Backend response:", data);

    // 5️⃣ Check if match found
    if (!data.match) {
      console.log("[findMatch] ⏳ No match yet, starting polling...");
      startPolling(userId, role);
      return null;
    }

    // 6️⃣ Match found!
    const match: MatchedUser = {
      matched_user_id: data.match.userId,
      username: data.match.userName,
      match_score: data.match.score ?? 100,
      avatar_url: data.match.avatarUrl ?? null,
      bio: data.match.bio ?? null,
      role: data.match.role,
    };

    console.log("[findMatch] 🎉 Match found!", match);

    await logMatchingEvent("match_found", {
      matched_user_id: match.matched_user_id,
      score: match.match_score,
    });

    stopPolling();
    return match;

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown matching error";
    console.error("[findMatch] ❌ Error:", message);

    await logMatchingEvent("error", { error: message });
    await cleanupPresence();
    stopPolling();
    
    toast.error("Failed to find match. Please try again.");
    return null;
  }
}


/* ===================== POLLING ===================== */

function startPolling(userId: string, role: "hero" | "uplifter") {
  stopPolling();
  console.log("[findMatch] startPolling (backend check-match)", { userId, role, intervalMs: 2000 });

  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/matching/check-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: String(userId), role }),
      });

      const contentType = res.headers.get("content-type");
      const data =
        contentType?.includes("application/json")
          ? await res.json()
          : { message: res.statusText || "Check match failed" };

      if (!res.ok) {
        if (res.status === 404) {
          console.log("[findMatch] polling: user not in queue (404), stopping");
          stopPolling();
          return;
        }
        if (res.status === 401) {
          console.warn("[findMatch] polling: unauthorized, stopping");
          stopPolling();
          return;
        }
        throw new Error(data.message || "Check match failed");
      }

      if (data.match) {
        const match: MatchedUser = {
          matched_user_id: data.match.userId,
          username: data.match.userName,
          match_score: data.match.score ?? 100,
          avatar_url: data.match.avatarUrl ?? null,
          bio: data.match.bio ?? null,
          role: data.match.role,
        };
        console.log("[findMatch] polling: match found", { matched_user_id: match.matched_user_id, username: match.username });
        window.dispatchEvent(new CustomEvent<MatchedUser>("matchFound", { detail: match }));
        stopPolling();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Polling error";
      console.warn("[findMatch] polling error", { message });
      await logMatchingEvent("polling_error", { error: message });
    }
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* ===================== CLEANUP ===================== */

export async function cleanupPresence() {
  try {
    const res = await fetch(`${API_BASE}/api/matching/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cleanup failed");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup error";
    await logMatchingEvent("cleanup_error", { error: message });
  }
}
