
import React, { useEffect, useRef, useState } from "react";
import socket from "../lib/socket.js";
import { useSessionStore } from '../store/session';
import {
  User,
  UserPlus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Phone,

} from "lucide-react";
const serverUri = import.meta.env.VITE_SERVER_URI;

// Improved STUN/TURN server configuration
const RTC_CONFIG = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:global.stun.twilio.com:3478",
      ],
    },
    {
      urls: "turn:numb.viagenie.ca",
      credential: "muazkh",
      username: "webrtc@live.com",
    },
  ],
  iceCandidatePoolSize: 10, // Helps with connection establishment
};

socket.on("connect", () => {
  // console.log("Socket connected successfully with ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  // console.log("Socket disconnected, reason:", reason);
});

interface User {
  username: string;
  socketId: string;
  role: string;
  dbId: string;
  state: string;
  rating: number;
}

// Enhanced MediaUtils for better track management
const MediaUtils = {
  getLocalStream: async (videoEnabled = true, audioEnabled = true) => {
    try {
      // Set reasonable constraints for better cross-device compatibility
      const constraints = {
        video: videoEnabled ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true
        } : false,
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  },

  stopStream: (stream: MediaStream | null) => {
    if (!stream) return;

    stream.getTracks().forEach(track => {
      try {
        track.stop();
        // console.log(`Successfully stopped ${track.kind} track: ${track.id}`);
      } catch (error) {
        console.error(`Error stopping ${track.kind} track:`, error);
      }
    });
  },

  toggleTrack: (stream: MediaStream | null, type: 'video' | 'audio', pc: RTCPeerConnection | null) => {
    if (!stream) return false;

    const tracks = type === 'video'
      ? stream.getVideoTracks()
      : stream.getAudioTracks();

    if (tracks.length === 0) return false;

    const track = tracks[0];
    track.enabled = !track.enabled;

    return track.enabled;
  },

  // New method to replace tracks in the peer connection
  replaceTrack: async (pc: RTCPeerConnection | null, stream: MediaStream | null, type: 'video' | 'audio') => {
    if (!pc || !stream) return;

    const senders = pc.getSenders();
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();

    if (tracks.length === 0) return;

    const track = tracks[0];
    const sender = senders.find(s => s.track && s.track.kind === type);

    if (sender) {
      try {
        await sender.replaceTrack(track);
        // console.log(`${type} track replaced successfully`);
      } catch (err) {
        console.error(`Error replacing ${type} track:`, err);
      }
    }
  }
};

const CallComponent: React.FC = () => {
  const [role, setRole] = useState<string>("");
  const [dbId, setDbId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState<string>("");
  const [callerName, setCallerName] = useState<string>("");
  const [callerOffer, setCallerOffer] =
    useState<RTCSessionDescriptionInit | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [idToCall, setIdToCall] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [userReadyToCall, setUserReadyToCall] = useState(false);
  const [userMood, setUserMood] = useState(1);
  const [finalMood, setFinalMood] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inappropriate, setInappropriate] = useState(false);
  const [userRating, setuserRating] = useState<number>()
  const [uplifterRating, setUplifterRating] = useState(0);
  const [callendfeedback, setCallendfeedback] = useState(false);  // must be false when deployment
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");

  const myVideo = useRef<HTMLVideoElement | null>(null);
  const userVideo = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [device, setDevice] = useState<string | null>(null);
  const [colleeDbId ,setColleeDbId] = useState<string | null>(null);
  const [myDevice, setMyDevice]= useState<string | null>(null);

  const {
    rating,
    currentRole,
    fetchUserStats
  } = useSessionStore();

  useEffect(() => {
    fetchUserStats()
    setuserRating(rating)
  }, [inCall])

  useEffect(() => {
    setRole(currentRole)
  }, [currentRole])
  useEffect(() => {

    setuserRating(rating)
  }, [])
  // console.log(userRating);
  // Apply stream to video element whenever it changes
  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
      localStreamRef.current = stream;
    }
  }, [stream]);

  // Monitor the connection state of the peer connection
  useEffect(() => {
    if (peerConnection.current) {
      const handleConnectionStateChange = () => {
        if (peerConnection.current) {
          setConnectionState(peerConnection.current.connectionState);
          // console.log("Connection state changed to:", peerConnection.current.connectionState);

          // Auto-restart if connection fails
          if (peerConnection.current.connectionState === 'failed' || peerConnection.current.connectionState === 'disconnected') {
            // console.log("Connection failed or disconnected, attempting to restart...");
            // Consider implementing a reconnection logic here
          }
        }
      };

      peerConnection.current.addEventListener('connectionstatechange', handleConnectionStateChange);

      return () => {
        if (peerConnection.current) {
          peerConnection.current.removeEventListener('connectionstatechange', handleConnectionStateChange);
        }
      };
    }
  }, [peerConnection.current]);

  // Start camera and get media stream with improved error handling
  const startCamera = async () => {
    try {
      // Stop any existing stream first
      if (stream) {
        MediaUtils.stopStream(stream);
      }

      // console.log("Starting camera with video:", isVideoEnabled, "audio:", isAudioEnabled);
      const mediaStream = await MediaUtils.getLocalStream(isVideoEnabled, isAudioEnabled);
      setStream(mediaStream);
      localStreamRef.current = mediaStream;

      if (myVideo.current) {
        myVideo.current.srcObject = mediaStream;
      }

      return mediaStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Could not access camera or microphone. Please check your permissions.");
      return null;
    }
  };

  // Stop camera and release media tracks
  const stopCamera = () => {
    MediaUtils.stopStream(stream);
    setStream(null);
    localStreamRef.current = null;

    if (myVideo.current) {
      myVideo.current.srcObject = null;
    }
  };

  const toggleVideo = async () => {
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const isCurrentlyEnabled = videoTracks[0].enabled;

    // Toggle the enabled state
    videoTracks.forEach(track => {
      track.enabled = !isCurrentlyEnabled;
      // console.log(`Video track ${track.id} enabled: ${track.enabled}`);
    });

    setIsVideoEnabled(!isCurrentlyEnabled);

    if (!isCurrentlyEnabled && inCall && peerConnection.current) {
      try {
        // Only restart video if it's being enabled again
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (stream) {
          // Replace the track in the peer connection
          await MediaUtils.replaceTrack(peerConnection.current, newStream, 'video');

          // Update the local video display
          if (myVideo.current) {
            myVideo.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.error("Error restarting video:", err);
        setIsVideoEnabled(false);
      }
    }
  };

  const toggleAudio = () => {
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const isCurrentlyEnabled = audioTracks[0].enabled;

    // Toggle the enabled state
    audioTracks.forEach(track => {
      track.enabled = !isCurrentlyEnabled;
      // console.log(`Audio track ${track.id} enabled: ${track.enabled}`);
    });

    setIsAudioEnabled(!isCurrentlyEnabled);
  };

  // Process any queued ICE candidates
  const processIceCandidates = () => {
    if (peerConnection.current && peerConnection.current.remoteDescription && iceCandidatesQueue.current.length > 0) {
      // console.log(`Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);

      iceCandidatesQueue.current.forEach(candidate => {
        peerConnection.current?.addIceCandidate(candidate)
          .catch(err => console.error("Error adding queued ICE candidate:", err));
      });

      iceCandidatesQueue.current = [];
    }
  };

  // Improved peer connection initialization with better logging
  const initializePeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    // console.log("Initializing new peer connection");
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const targetId = inCall ? idToCall : caller;
        // console.log("Generated ICE candidate for:", event.candidate.candidate.substring(0, 50) + "...");
        socket.emit("ice:candidate", {
          to: targetId,
          candidate: event.candidate,
        });
      }
    };

    // Better track handling
    pc.ontrack = (event) => {
      // console.log("Received remote track:", event.track.kind);
      if (userVideo.current && event.streams && event.streams[0]) {
        userVideo.current.srcObject = event.streams[0];
      }
    };

    // More comprehensive connection state monitoring
    pc.onconnectionstatechange = () => {
      // console.log("Connection state changed:", pc.connectionState);
      setConnectionState(pc.connectionState);

      if (pc.connectionState === "connected") {
        processIceCandidates();
      }
    };

    pc.oniceconnectionstatechange = () => {
      // console.log("ICE connection state:", pc.iceConnectionState);

      // Handle ICE restart if needed
      if (pc.iceConnectionState === "failed") {
        // console.log("ICE connection failed, attempting to restart ICE");
        if (pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    // Add signaling state change handler
    pc.onsignalingstatechange = () => {
      // console.log("Signaling state changed:", pc.signalingState);
    };

    // Handle negotiation needed events
    pc.onnegotiationneeded = async () => {
      // console.log("Negotiation needed event triggered");
      if (inCall && pc.signalingState === "stable") {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const targetId = inCall ? idToCall : caller;
          // console.log("Sending renegotiation offer to:", targetId);

          socket.emit("peer:nego:needed", {
            to: targetId,
            offer: pc.localDescription,
          });
        } catch (err) {
          console.error("Error during renegotiation:", err);
        }
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  // Enhanced track addition with better logging
  const addLocalTracks = (pc: RTCPeerConnection, mediaStream: MediaStream) => {
    mediaStream.getTracks().forEach(track => {
      // console.log("Adding local track to peer connection:", track.kind, track.id);
      pc.addTrack(track, mediaStream);
    });
  };

  // Set up socket event listeners with improved error handling
  useEffect(() => {
    socket.on("me", (id: string) => {
      // console.log("My socket ID:", id);
    });

    socket.on("usersList", (users) => {
      setUsers(users);
      // console.log("Updated users list:", users);
    });

    socket.on("incomming:call", async (data: any) => {
      // console.log("Incoming call from", data.from, "with name", data.callerName);
      setReceivingCall(true);
      setCaller(data.from);
      setCallerOffer(data.offer);
      setCallerName(data.callerName || "Someone");
    });

    socket.on("ice:candidate", ({ from, candidate }) => {
      // console.log("Received ICE candidate from:", from);

      try {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          // Connection is established, add candidate directly
          peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error("Error adding ICE candidate:", err));
        } else {
          // Queue the candidate for later
          // console.log("Queueing ICE candidate for later processing");
          iceCandidatesQueue.current.push(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error processing ICE candidate:", err);
      }
    });

    socket.on("call:end", () => {
      // console.log("Call ended by peer or timeout");
      cleanupCall();

      if (role === "hero") {
        setCallendfeedback(true);
      }
    });

    socket.on("call:accepted", async ({ from, ans }) => {
      // console.log("Call accepted with answer from", from);
      setCallAccepted(true);

      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(ans));
          // console.log("Remote description set successfully");
          processIceCandidates();
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    });

    socket.on("peer:nego:needed", async ({ from, offer }) => {
      // console.log("Peer negotiation needed from:", from);

      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          socket.emit("peer:nego:done", { to: from, ans: answer });
        } catch (err) {
          console.error("Error during negotiation:", err);
        }
      }
    });

    socket.on("peer:nego:final", async ({ from, ans }) => {
      // console.log("Peer negotiation finalized from", from);

      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(ans));
          // console.log("Final remote description set");
          processIceCandidates();
        } catch (err) {
          console.error("Error setting final remote description:", err);
        }
      }
    });

    return () => {
      // Clean up event listeners
      socket.off("me");
      socket.off("incomming:call");
      socket.off("usersList");
      socket.off("ice:candidate");
      socket.off("call:end");
      socket.off("call:accepted");
      socket.off("peer:nego:needed");
      socket.off("peer:nego:final");
    };
  }, []);

  // Keep users list up to date
  useEffect(() => {
    socket.on("usersList", (users) => {
      setUsers(users);
    });
  }, [inCall, role, finalMood, callerName]);


  const cleanupCall = () => {
    // console.log("Cleaning up call resources");

    const currentUserRole = role;
    // console.log("Cleaning up call for role:", currentUserRole);

    // Stop all media tracks safely
    if (stream) {
      // console.log("Stopping all media tracks from stream");
      stream.getTracks().forEach(track => {
        if (track.readyState === "live") {
          track.stop();
          // console.log(`Stopped ${track.kind} track: ${track.id}`);
        }
      });
    }

    // Stop any tracks from localStreamRef as well
    if (localStreamRef.current) {
      // console.log("Stopping all tracks from localStreamRef");
      localStreamRef.current.getTracks().forEach(track => {
        if (track.readyState === "live") {
          track.stop();
          // console.log(`Stopped ${track.kind} track from localStreamRef: ${track.id}`);
        }
      });
    }

    // Release video elements
    if (myVideo.current) {
      myVideo.current.srcObject = null;
      // console.log("Cleared myVideo stream");
    }

    if (userVideo.current) {
      userVideo.current.srcObject = null;
      // console.log("Cleared userVideo stream");
    }

    // Close peer connection
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
        // console.log("Peer connection closed");
      } catch (err) {
        console.error("Error closing peer connection:", err);
      }
      peerConnection.current = null;
    }

    // Reset ICE candidates queue
    iceCandidatesQueue.current = [];

    // Reset states
    setStream(null);
    localStreamRef.current = null;
    setInCall(false);
    setUplifterRating(0);
    setCallAccepted(false);
    setCallEnded(true);
    setConnectionState("new");

    // Update call history status by emitting event to server
    socket.emit("call:status:update", { status: "ended" });

    // Show feedback for hero role
    if (currentUserRole === "hero") {
      // console.log("Showing feedback modal for hero");
      setCallendfeedback(true);
    }
  };

  const handleUserReadyToCall = (id: string, dbId:string, device:string, name: string) => {
    setUserReadyToCall(true);
    setCallerName(name)
    setColleeDbId(dbId);
    setDevice(device);
    setIdToCall(id);
  };

  // Improved call initiation
  const callUser = async (id: string) => {


    if(device==="desktop" && myDevice === "mobile"){
    socket.emit("call:mobile-to-desktop",({ id, callerName, device, dbId }));
    }
    setUserReadyToCall(false);

    try {
      // console.log("Starting call to user with ID:", id);

      // Start camera and get media stream
      const localStream = await startCamera();
      if (!localStream) {
        console.error("Failed to get local stream");
        alert("Could not access camera or microphone. Please check your permissions.");
        return;
      }

      setInCall(true);

      // Initialize peer connection
      const pc = initializePeerConnection();

      // Add local tracks to peer connection
      addLocalTracks(pc, localStream);

      // Wait for ICE gathering to begin before creating offer
      setTimeout(async () => {
        try {
          // Create and set local description (offer)
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });

          await pc.setLocalDescription(offer);
          // console.log("Local description set (offer)");

          // Send the offer to the remote peer
          socket.emit("user:call", {
            to: id,
            offer,
            userMood: userMood,
            callerName: username
          });

          setIdToCall(id);
        } catch (err) {
          console.error("Error creating/setting offer:", err);
          cleanupCall();
          alert("Failed to start call. Please try again.");
        }
      }, 500); // Short delay to allow ICE gathering to start

    } catch (error) {
      console.error("Error starting call:", error);
      cleanupCall();
      alert("Failed to start call. Please check your camera and microphone permissions.");
    }
  };

  // Submit feedback after call ends
  const handleFeedBack = () => {
    // console.log("Submitting feedback:", finalMood, feedback, inappropriate, uplifterRating);

    if (!feedback) {
      setError("Please provide your feedback");
      return;
    }

    if (finalMood === 0) {
      setError("Please provide your mood rating");
      return;
    }
    if (uplifterRating === 0) {
      setError("Please provide your uplift rating");
      return;
    }

    if (role === "hero") {
      setCallendfeedback(false);
      socket.emit("feedback", finalMood, feedback, inappropriate, uplifterRating);
    }
    setInappropriate(false);
    setFeedback("");
    setFinalMood(0);
  };

  // Enhanced answer call flow
  const answerCall = async () => {
    try {
      // console.log("Answering incoming call from:", caller, callerName);
      setReceivingCall(false);

      // Start camera if not already started
      const localStream = await startCamera();
      if (!localStream) {
        console.error("Failed to get local stream");
        alert("Could not access camera or microphone. Please check your permissions.");
        return;
      }

      setInCall(true);
      setCallAccepted(true);

      // Initialize peer connection
      const pc = initializePeerConnection();

      // Add local tracks to peer connection
      addLocalTracks(pc, localStream);

      // Set remote description (offer from caller)
      if (callerOffer) {
        try {
          // console.log("Setting remote description from caller offer");
          await pc.setRemoteDescription(new RTCSessionDescription(callerOffer));
          // console.log("Remote description set (incoming offer)");

          // Process any queued ICE candidates
          processIceCandidates();

          // Add a small delay to ensure remote description is fully processed
          setTimeout(async () => {
            try {
              // Create and set local description (answer)
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              // console.log("Local description set (answer)");

              // Send the answer to the caller
              socket.emit("call:accepted", { to: caller, ans: answer });
            } catch (err) {
              console.error("Error creating/setting answer:", err);
              cleanupCall();
              alert("Failed to connect to call. Please try again.");
            }
          }, 500);

        } catch (err) {
          console.error("Error processing offer/creating answer:", err);
          cleanupCall();
          alert("Failed to connect to call. Please try again.");
        }
      } else {
        console.error("No caller offer available");
        cleanupCall();
        alert("Missing call information. Please ask the caller to try again.");
      }
    } catch (error) {
      console.error("Error answering call:", error);
      cleanupCall();
      alert("Failed to answer call. Please check your camera and microphone permissions.");
    }
  };

  const endCall = () => {
    try {
      // console.log("Ending call");
      const targetId = caller || idToCall;

      // Notify the other user before cleaning up
      socket.emit("call:end", { to: targetId });

      // If current user is uplifter, ensure hero gets feedback prompt
      if (role === "uplifter") {
        // Send additional event to ensure hero shows feedback
        socket.emit("call:feedback:needed", { to: targetId });
      }

      // Then clean up resources
      cleanupCall();

    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  useEffect(() => {
    // ... existing socket event listeners

    socket.on("call:end", (data) => {
      // console.log("Call ended by peer or timeout");

      // Force feedback modal for hero regardless of who ended the call
      if (role === "hero") {
        // console.log("Hero received call:end event, showing feedback");
        setCallendfeedback(true);
      }

      cleanupCall();
    });

    socket.on("call:feedback:needed", () => {
      // console.log("Feedback needed event received");
      if (role === "hero") {
        setCallendfeedback(true);
      }
    });

    return () => {
      // ... existing cleanup
      socket.off("call:feedback:needed");
    };
  }, [role]);

  // Fetch user info and register with socket server
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(`https://www.upliftmee.com/api/user/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Invalid email or password");
        }

        if (data?.username) {
          setRole(data.role);
          setUsername(data.username);
          setDbId(data.id);
          // setuserRating(data.ratings)
          // console.log(data.ratings);

          // Register user with socket server
          if (data.ratings === null) {
            data.ratings = 1;
          }

          // socket.emit("registerUser", {
          //   username: data.username,
          //   dbid: data.id,
          //   role: data.role,
          //   rating: data.ratings,
          //   device:device,
          // });
        } else {
          throw new Error("User login failed or invalid response");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    };

    fetchUserInfo();

    // Clean up on component unmount
    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      stopCamera();
    };
  }, []);

  useEffect(() => {
    socket.on('registerAgain', () => {
      // console.log("Registering again");
      if (userRating === null) {
        setuserRating(1)
      }
      socket.emit("registerUser", {
        username: username,
        dbid: dbId,
        role: role,
        ratings: userRating,
      });
    })

  }, [])


  return (
    <div className="container mx-auto px-1 py-4 md:px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          {username ? (
            <div className="flex items-center justify-between">
              <div>
                {(role === "uplifter" || role === "hero") && (
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
                    {username} 
                  </h1>
                )}
                <div className="text-gray-600 dark:text-gray-400 mt-1"> {/*replaced with <p></p>*/}
                  {role === "uplifter" && (
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mr-2">
                        <span className="w-2 h-2 mr-1 bg-green-500 rounded-full animate-pulse"></span>
                        Online
                      </span>
                      Heroes available: {users.filter(user => user.role === 'hero' && user.state === 'online').length}
                    </div>
                  )}
                </div>
              </div>
              {role && (
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-gray-300 dark:bg-gray-600 h-10 w-10"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-36"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        {!inCall ? (
          <>
            {role === 'hero' && (
              <div className="p-1 md:p-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800 dark:text-gray-200">
                  <User className="w-5 h-5 mr-2 text-purple-500" />
                  Uplifters Ready for Support ({users.filter(user => user.role === 'uplifter').length})
                </h2>

                {users.length > 0 ? (
                  <div className="space-y-3">
                    {/* Group and sort users by rating (5 stars first, then 4, etc.) */}
                    {users
                      .filter(user => user.dbId !== dbId && user.role === "uplifter" && user.state === 'online')
                      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                      .length > 0 ? (
                      users
                        .filter(user => user.dbId !== dbId && user.role === "uplifter" && user.state === 'online')
                        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                        .map((user, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex items-center">
                              <div className="bg-purple-100 dark:bg-purple-900  rounded-full mr-3">
                                <UserPlus className="w-5 h-5 text-purple-500 dark:text-purple-300" />
                              </div>
                              <div>
                                <h3 className="font-medium">{user.username} {user.device}</h3>
                                <div className="flex flex-col space-y-1">
                                  {/* Star Rating Display */}
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <svg
                                        key={i}
                                        className={`w-4 h-4 ${i < (user.rating || 0) ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                      ({user.rating || 0})
                                    </span>
                                  </div>
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                                    Available for Session as {user.role}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <button
                              className="flex items-center bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105"
                              onClick={() => handleUserReadyToCall(user.socketId, user.dbId, user.device, user.username)}
                            >
                              <Phone className="w-4 h-4 mr-1" />
                              Start
                            </button>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
                        <div className="flex justify-center">
                          <div className="bg-gray-200 dark:bg-gray-600 p-4 rounded-full inline-flex">
                            <UserPlus className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mt-4">
                          Searching for uplifters...
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          No uplifters are currently available
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-center">
                      <div className="bg-gray-200 dark:bg-gray-600 p-4 rounded-full inline-flex">
                        <UserPlus className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>
                    <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mt-4">
                      No users available
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Waiting for other users to connect...
                    </p>
                    <div className="mt-4 flex justify-center">
                      <div className="animate-bounce flex space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animation-delay-200"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animation-delay-400"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  {callAccepted ? (
                    <>
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                      Connected
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                      <span className="flex items-center">
                        Connecting
                        <span className="ml-1 flex">
                          <span className="animate-bounce mx-0.5">.</span>
                          <span className="animate-bounce animation-delay-200 mx-0.5">.</span>
                          <span className="animate-bounce animation-delay-400 mx-0.5">.</span>
                        </span>
                      </span>
                    </>
                  )}
                </h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {/* Call duration: 00:00 */}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video shadow-lg">
                  {isVideoEnabled ? (
                    <video
                      ref={myVideo}
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-2xl">
                        {username?.charAt(0).toUpperCase() || "Y"}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {!isVideoEnabled && (
                      <div className="bg-red-500 text-white text-xs py-1 px-2 rounded">
                        Video Off
                      </div>
                    )}
                    {!isAudioEnabled && (
                      <div className="bg-red-500 text-white text-xs py-1 px-2 rounded mt-1">
                        Audio Off
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white text-sm py-1 px-2 rounded">
                    You ({username})
                  </div>
                </div>

                <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video shadow-lg">
                  {callAccepted ? (
                    <>
                      <video
                        ref={userVideo}
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white text-sm py-1 px-2 rounded">
                        {callerName || "Remote User"}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                        <p className="text-gray-300">
                          Waiting for remote user to join...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={toggleAudio}
                  className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 shadow ${isAudioEnabled
                    ? "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                    : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {isAudioEnabled ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 shadow ${isVideoEnabled
                    ? "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                    : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all duration-300 transform hover:scale-110 shadow"
                  title="End call"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incoming call modal */}
        {receivingCall && !callAccepted && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 animate-bounce-once shadow-2xl border border-purple-200 dark:border-purple-900">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Phone className="w-8 h-8 text-purple-500 dark:text-purple-300" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Incoming Call</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {callerName || "Someone"} is calling you
                </p>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  onClick={() => setReceivingCall(false)}
                >
                  Decline
                </button>
                <button
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center transition-colors"
                  onClick={answerCall}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ready to call modal */}
        {userReadyToCall && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex p-8 items-center justify-center z-50 backdrop-blur-sm">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-200 dark:border-purple-900">
              <button
                onClick={() => setUserReadyToCall(false)}
                className="absolute top-3 right-3 bg-gray-200 dark:bg-gray-700 p-1 w-8 h-8 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition-colors flex items-center justify-center"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>

              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <User className="w-8 h-8 text-purple-500 dark:text-purple-300" />
                </div>
                <h3 className="text-xl font-semibold mb-2">How are you feeling right now?</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Rate your current mood before the call</p>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="flex items-center w-full justify-between mb-2">
                  <span className="text-xs text-gray-500">😢 Low</span>
                  <span className="text-xs text-gray-500">😄 Great</span>
                </div>

                <div className="flex items-center w-full mb-2">
                  <input
                    type="range"
                    id="moodRating"
                    name="moodRating"
                    min="1"
                    max="5"
                    step="1"
                    value={userMood}
                    className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    onChange={(e) => setUserMood(parseInt(e.target.value))}
                  />
                </div>

                <div className="flex justify-between w-full px-2">
                  <span role="img" aria-label="sad" className={`text-2xl ${userMood === 1 ? 'opacity-100 scale-125' : 'opacity-50'} transition-all`}>😢</span>
                  <span role="img" aria-label="frown" className={`text-2xl ${userMood === 2 ? 'opacity-100 scale-125' : 'opacity-50'} transition-all`}>😔</span>
                  <span role="img" aria-label="neutral" className={`text-2xl ${userMood === 3 ? 'opacity-100 scale-125' : 'opacity-50'} transition-all`}>😐</span>
                  <span role="img" aria-label="smile" className={`text-2xl ${userMood === 4 ? 'opacity-100 scale-125' : 'opacity-50'} transition-all`}>😊</span>
                  <span role="img" aria-label="happy" className={`text-2xl ${userMood === 5 ? 'opacity-100 scale-125' : 'opacity-50'} transition-all`}>😄</span>
                </div>
              </div>

              <button
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center transition-colors"
                onClick={() => callUser(idToCall)}
              >
                <Phone className="w-5 h-5 mr-2" />
                Start Call
              </button>
            </div>
          </div>
        )}

        {/* Feedback modal */}
        {role === "hero" && callendfeedback && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-200 dark:border-purple-900">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4 mx-auto">
                  {/* <MessageSquare className="w-8 h-8 text-purple-500 dark:text-purple-300" /> */}
                </div>
                <h3 className="text-xl font-semibold mb-1">Session Feedback</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">How do you feel after this conversation?</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-3">
                    Current Mood
                  </label>
                  <div className="flex justify-between space-x-2">
                    <label
                      onClick={() => setFinalMood(1)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <input type="radio" name="mood" value="1" checked={finalMood === 1} className="sr-only peer" onChange={() => { }} />
                      <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 ${finalMood === 1 ? 'bg-[#EF4444] ring-4 ring-red-200 dark:ring-red-600 transform scale-110' : 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50'}`}>
                        😢
                      </div>
                      <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">Very Low</span>
                    </label>

                    <label
                      onClick={() => setFinalMood(2)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <input type="radio" name="mood" value="2" checked={finalMood === 2} className="sr-only peer" onChange={() => { }} />
                      <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 ${finalMood === 2 ? 'bg-[#F97316] ring-4 ring-orange-200 dark:ring-orange-600 transform scale-110' : 'bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50'}`}>
                        😔
                      </div>
                      <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">Low</span>
                    </label>

                    <label
                      onClick={() => setFinalMood(3)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <input type="radio" name="mood" value="3" checked={finalMood === 3} className="sr-only peer" onChange={() => { }} />
                      <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 ${finalMood === 3 ? 'bg-[#84CC16] ring-4 ring-lime-200 dark:ring-lime-600 transform scale-110' : 'bg-lime-100 dark:bg-lime-900/30 group-hover:bg-lime-200 dark:group-hover:bg-lime-900/50'}`}>
                        😐
                      </div>
                      <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">Neutral</span>
                    </label>

                    <label
                      onClick={() => setFinalMood(4)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <input type="radio" name="mood" value="4" checked={finalMood === 4} className="sr-only peer" onChange={() => { }} />
                      <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 ${finalMood === 4 ? 'bg-[#06B6D4] ring-4 ring-cyan-200 dark:ring-cyan-600 transform scale-110' : 'bg-cyan-100 dark:bg-cyan-900/30 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50'}`}>
                        😊
                      </div>
                      <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">Good</span>
                    </label>

                    <label
                      onClick={() => setFinalMood(5)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <input type="radio" name="mood" value="5" checked={finalMood === 5} className="sr-only peer" onChange={() => { }} />
                      <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 ${finalMood === 5 ? 'bg-[#0EA5E9] ring-4 ring-sky-200 dark:ring-sky-600 transform scale-110' : 'bg-sky-100 dark:bg-sky-900/30 group-hover:bg-sky-200 dark:group-hover:bg-sky-900/50'}`}>
                        😄
                      </div>
                      <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">Great</span>
                    </label>
                  </div>
                </div>

                {/* New Star Rating for Uplifter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-3">
                    Rate Your Uplifter
                  </label>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUplifterRating(star)}
                        className="focus:outline-none transition-transform"
                      >
                        <svg
                          className={`w-8 h-8 md:w-10 md:h-10 ${uplifterRating >= star
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'} 
                    hover:scale-110 transition-all duration-200`}
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="1"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Additional Feedback
                  </label>
                  <textarea
                    value={feedback || ""}
                    placeholder="Please share your thoughts about the session..."
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-24 transition-all"
                  />
                </div>

                {/* Modified Red Flag Checkbox */}
                <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/30 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <div className="relative">
                    <input
                      id="inappropriate"
                      type="checkbox"
                      checked={inappropriate}
                      onChange={() => setInappropriate(!inappropriate)}
                      className="w-5 h-5 bg-white dark:bg-gray-700 border-2 border-red-400 dark:border-red-500 rounded focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 appearance-none cursor-pointer checked:bg-red-500 checked:border-red-500 transition-colors"
                    />
                    {inappropriate && (
                      <svg
                        className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                  <label htmlFor="inappropriate" className="ml-2 text-sm font-medium text-red-600 dark:text-red-400 cursor-pointer">
                    Flag this session as inappropriate
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                  onClick={() => handleFeedBack()}
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallComponent;








































