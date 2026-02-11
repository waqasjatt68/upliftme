import React, { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session';
import socket from '../lib/socket';
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import {
  User,
  UserPlus,
  Phone,
  PhoneOff,
  X,
  Loader,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Clock,
  Signal,
  AlertTriangle,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
 
import SessionTimer from '../components/SessionTimer';
interface Error {
  message: string | null;
}
import {
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
} from '@livekit/components-react';

// Define API URLs with environment variables or fallbacks
const API_URL =  'https://api.uplifmee.com'; // Replace with your actual API URL
const LIVEKIT_URL =  'wss://uplifmee-1l4lk2qd.livekit.cloud';


function MyVideoConference() {
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      // Removed ScreenShare track
    ],
    { onlySubscribed: false }
  );

  const remoteTracks = allTracks.filter((t) => !t.participant.isLocal);
  const localTrack = allTracks.find((t) => t.participant.isLocal);

  return (
    <div className="relative w-full max-w-3xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-purple-500">
      {remoteTracks.length > 0 ? (
        remoteTracks
          .filter((trackRef) => trackRef.publication)
          .map((trackRef) => (
            <div key={trackRef.publication!.trackSid} className="w-full h-full">
           
              <ParticipantTile
                trackRef={trackRef}
                className="[&>*]:hidden [&>video]:block w-full h-full object-contain"
              />
              {/* <div className="absolute bottom-3 left-3 text-white text-sm bg-black/40 backdrop-blur px-3 py-1 rounded-full shadow-sm">
                {trackRef.participant.identity}
              </div> */}
            </div>
          ))
      ) : (
        <div className="w-full h-full flex items-center justify-center flex-col text-white">
          <Loader className="w-10 h-10 text-purple-400 mb-4 animate-spin" />
          <p className="text-lg font-medium">Waiting for participant...</p>
          <p className="text-xs text-gray-400 mt-2">Your camera is active</p>
        </div>
      )}

      {localTrack?.publication && (
        <div className="absolute bottom-4 right-4 w-24 sm:w-32 aspect-[3/4] bg-black rounded-lg overflow-hidden shadow-lg border border-purple-400">
          <ParticipantTile
            trackRef={localTrack}
            className="w-full h-full object-contain [&_[data-lk-participant-name]]:hidden"
          />
          <div className="absolute bottom-1 left-0 right-0 text-center text-white text-xs bg-black/50 backdrop-blur-sm py-0.5">
            You
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 text-white text-xs bg-purple-600 backdrop-blur px-3 py-1 rounded-full shadow-sm flex items-center">
        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
        Live Session
      </div>
    </div>
  );
}





// User interface type definition
interface User {
  username: string;
  socketId: string;
  role: string;
  dbId: string;
  state: string;
  rating: number;
  profilePicture: string;
}

const Counter = () => {
  // Session data from your store
  const { dbId, currentRole, rating, userName } = useSessionStore();
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  
  // Room and connection states
  const [room] = useState<Room>(() => new Room({
    adaptiveStream: true,
    dynacast: true,
  }));
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);  
  // Call states
  const [userReadyToCall, setUserReadyToCall] = useState(false);
  const [callerName, setCallerName] = useState<string>("");
  const [idToCall, setIdToCall] = useState<string>("");
  const [colleeDbId, setColleeDbId] = useState<string | null>(null);


  //usermood
  const [userMood, setUserMood] = useState(1);
  const [finalMood, setFinalMood] = useState(1);
  const [callendfeedback, setCallEndFeedback] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inappropriate, setInappropriate] = useState(false);
  const [uplifterRating, setUplifterRating] = useState(0);
  const [callacceptedpromis ,setcallacceptedpromis] = useState(false)


  const [ incomingCallRoom , setIncomingCallRoom] = useState<string | null>(null);
  const [incomingCallName, setIncomingCallName] = useState(false);
  const [incomingCallPrompt, setIncomingCallPrompt] = useState(false); 
  const[callerId, setCallerId] = useState<string | null>(null);
  // Check for media permissions
  const checkMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Release tracks immediately to not keep the camera/mic active
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error("Media permission error:", err);
      setError("Please allow camera and microphone access to make calls");
      return false;
    }
  };

  // Connect to LiveKit room
  const connectToRoom = useCallback(async (identity: string, roomName: string) => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      // Request token from API
      const response = await fetch(`https://www.upliftmee.com/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ callerName: identity, roomName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to get token: ${response.status} ${errorData.message}`);
      }

      const data = await response.json();
      // console.log("Token generated successfully");
      
      // Connect to room
      await room.connect(LIVEKIT_URL, data.token);
      
      // Enable camera and microphone
      await room.localParticipant.enableCameraAndMicrophone();
      
      setConnectionStatus('connected');
      setConnected(true);
      return true;
    } catch (err) {
      console.error("Room connection error:", err);
      setConnectionStatus('failed');
      setError(err instanceof Error ? err.message : "Failed to connect to video call");
      return false;
    }
  }, [room]);

  // Handle user list updates from socket
  useEffect(() => {
    const handleUsersList = (data:any) => {
      setUsers(data);
    };
    
    socket.on("usersList", handleUsersList);
    
    return () => {
      socket.off("usersList", handleUsersList);
    };
  }, []);


  // Handle incoming call offers
  useEffect(() => {
    const handleOfferVideoCall = async (data:any) => {
      // console.log('Call offer received', data);
      setIncomingCallRoom(data.roomName)
      setIncomingCallName(data.callerName)
      setIncomingCallPrompt(true)
      setCallerId(data.socketId)
      // console.log(data.socketId)
      
      // await acceptCall(data.roomName);
    };
    const handleRemoteEndCall = async () => {
      
      remoteEndCall()
    }
    
    const endCall = () => {
      if (room) {
        room.disconnect();
      }
      setConnectionStatus('disconnected');
      setConnected(false);
      setError(null);
    };

    const handleCallAcceptedPromis = ()=>{
      setcallacceptedpromis(true)
      // console.log("call accepted");
      
    }
    socket.on("callAccepted",handleCallAcceptedPromis)
    socket.on("offerVideoCall", handleOfferVideoCall);
    socket.on("endFromPromptVideoCall",endCall);
    socket.on("endVideoCall",handleRemoteEndCall)
    return () => {
      socket.off("endFromPromptVideoCall",endCall);
      socket.off("callAccepted",handleCallAcceptedPromis)
      socket.off("offerVideoCall", handleOfferVideoCall);
      socket.off("endVideoCall",handleRemoteEndCall)
    };
  }, []);

  const acceptCallFromPromt = (incomingCallRoom:string)=>{
    setIncomingCallPrompt(false)
    // console.log(callerId);
    
    acceptCall(incomingCallRoom)
  }
  const endCallFromPromt = (incomingCallRoom:string)=>{
    setIncomingCallPrompt(false)
   

    remoteEndCall()
    socket.emit("endFromPromptVideoCall", { roomName: incomingCallRoom, callerName: callerName, socketId: callerId });
  }



  // Room cleanup on component unmount
  useEffect(() => {
    return () => {
      if (room && (room.state === 'connected' || room.state === 'connecting')) {
        room.disconnect();
      }
    };
  }, [room]);

  // Prepare to call user
  const handleUserReadyToCall = (id: string, dbId: string, name: string) => {
    setUserReadyToCall(true);
    setCallerName(name);
    setColleeDbId(dbId);
    setIdToCall(id);
  };

  // Initiate call
  const callUser = async (id: string) => {
    setUserReadyToCall(false);
    // Check media permissions first
    const hasPermissions = await checkMediaPermissions();
    if (!hasPermissions) {
      return;
    }
    
    try {
      // Connect to room first
      const connected = await connectToRoom(dbId, dbId);
      
      if (connected) {
        // Then emit socket event to notify the other user
        socket.emit('offerVideoCall', {
          callerName: userName,
          roomName: dbId,
          colleeId: id,
          userMood: userMood,
        });
      }
    } catch (error) {
      console.error("Error starting call:", error);
      setError("Failed to start call. Please try again.");
    }
  };

  // Accept incoming call
  const acceptCall = async (roomName: string) => {
    // Check media permissions first
    const hasPermissions = await checkMediaPermissions();
    if (!hasPermissions) {
      return;
    }
    
    try {
      await connectToRoom(dbId, roomName);
      // console.log("Call accepted:", callerId);
      
    socket.emit("callAccepted",{callerId: callerId});
    } catch (error) {
      console.error("Error accepting call:", error);
      setError("Failed to accept call. Please try again.");
    }
  };

  // End the active call
  const endCall = () => {

    if (room) {
      room.disconnect();
    }
    // console.log(callacceptedpromis);
    
    if(currentRole==="hero"  && callacceptedpromis){
       socket.emit('endVideoCall', { idToEndCall: idToCall });
       setCallEndFeedback(true)
      }
    else{
      socket.emit('endVideoCall', { idToEndCall: callerId });
    }
    setConnectionStatus('disconnected');
    setConnected(false);
    setError(null);
  };

  const remoteEndCall = () => {
    if (room) {
      room.disconnect();
    }4

    if(currentRole==="hero"){
      setCallEndFeedback(true)
     }
   
    setConnectionStatus('disconnected');
    setConnected(false);
    setError(null);
  };

  const handleFeedBack = async () => {
    let heroId
    if(currentRole==="hero"){
      heroId = callerId
    }
    setCallEndFeedback(false)
    setcallacceptedpromis(false)
    
    socket.emit("feedback", { callerId, feedback, finalMood, inappropriate, uplifterRating });
    // console.log("Feedback sent:", { callerId, feedback, finalMood, inappropriate, uplifterRating });
    
  }

  return (
    <div>

      
    
{connectionStatus === 'connected' && (
  <RoomContext.Provider value={room}>
    <div className="w-full p-6 bg-gray-950 text-white rounded-lg shadow-xl border border-purple-600 space-y-5">
      
      {/* Session Timer */}
      <div className="w-full flex justify-center">
        <div className="bg-gray-800 rounded-full px-4 py-1 text-sm font-medium text-gray-200 flex items-center space-x-2 mb-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <SessionTimer />
        </div>
      </div>
      
      {/* Enhanced Video Box */}
      <div className="w-full flex justify-center">
        <MyVideoConference />
      </div>

      {/* Audio Renderer */}
      <RoomAudioRenderer />

      {/* Custom Simplified Controls */}
      <div className="w-full flex justify-center">
        <div className="flex space-x-4 items-center">
          {/* Mute/Unmute */}
          <button 
            onClick={() => room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)}
            className={`p-4 rounded-full ${room.localParticipant.isMicrophoneEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500`}
          >
            {room.localParticipant.isMicrophoneEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </button>
          
          {/* Camera Toggle */}
          <button 
            onClick={() => room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)}
            className={`p-4 rounded-full ${room.localParticipant.isCameraEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500`}
          >
            {room.localParticipant.isCameraEnabled ? (
              <Camera className="w-6 h-6" />
            ) : (
              <CameraOff className="w-6 h-6" />
            )}
          </button>
          
          {/* End Call Button - Made larger and more prominent */}
          <button 
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform hover:scale-105"
            onClick={endCall}
          >
            <div className="flex items-center space-x-2">
              <PhoneOff className="w-6 h-6" />
            </div>
          </button>
        </div>
      </div>
      
      {/* Connection Quality Indicator */}
      <div className="w-full flex justify-center">
        <div className="bg-gray-800 rounded-full px-4 py-1 text-xs font-medium text-gray-300 flex items-center space-x-2">
          <Signal className="w-4 h-4 text-green-400" />
          <span>Connection: Good</span>
        </div>
      </div>
    </div>
  </RoomContext.Provider>
)}




      
      {/* Connecting Status UI */}
      {/* {connectionStatus === 'connecting' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
            <Loader className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Connecting to call...</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Setting up your video connection
            </p>
          </div>
        </div>
      )} */}

{connectionStatus === 'connecting' && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
    <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-purple-500 text-center max-w-md w-full mx-4 animate-fade-in">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping"></div>
        <div className="relative flex items-center justify-center w-full h-full bg-purple-600 rounded-full">
          <Loader className="w-10 h-10 text-white animate-spin" />
        </div>
      </div>
      <h3 className="text-2xl font-semibold mb-3 text-white">Connecting to session...</h3>
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span>Setting up secure connection</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          </div>
          <span>Initializing audio/video</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
          </div>
          <span>Joining session room</span>
        </div>
      </div>
      <p className="text-gray-400 text-sm mt-6">
        This may take a few moments...
      </p>
    </div>
  </div>
)}
      
      {/* Connection Error UI */}
      {/* {connectionStatus === 'failed' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="text-red-500 text-center mb-4">
              <X className="w-10 h-10 mx-auto mb-2" />
              <h3 className="text-xl font-medium">Connection Failed</h3>
              <p className="mt-2 text-gray-700 dark:text-gray-300">{error == null ? "Could not establish call connection" : typeof error === "string" ? error : (error.message || "Could not establish call connection")}</p>
            </div>
            <div className="flex justify-center">
              <button 
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                onClick={() => setConnectionStatus('disconnected')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )} */}

{connectionStatus === 'failed' && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
    <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-500 max-w-md w-full mx-4">
      <div className="text-red-500 text-center mb-6">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-red-500/20"></div>
          <div className="relative flex items-center justify-center w-full h-full bg-red-600 rounded-full">
            <X className="w-10 h-10 text-white" />
          </div>
        </div>
        <h3 className="text-2xl font-medium text-white">Connection Failed</h3>
        <p className="mt-3 text-gray-300">{error == null ? "Could not establish call connection" : typeof error === "string" ? error : (error.message || "Could not establish call connection")}</p>
      </div>
      
      <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-4 mb-6">
        <div className="flex space-x-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-sm text-red-300">
            <p>This could be due to:</p>
            <ul className="list-disc pl-5 mt-1 text-red-200">
              <li>Internet connection issues</li>
              <li>Microphone or camera permissions denied</li>
              <li>Server unavailability</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <button 
          className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          onClick={() => window.location.reload()}
        >
          <div className="flex items-center justify-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>Refresh</span>
          </div>
        </button>
        
        <button 
          className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          onClick={() => setConnectionStatus('disconnected')}
        >
          <div className="flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Go Back</span>
          </div>
        </button>
      </div>
    </div>
  </div>
)}
      
      {/* Mood Rating Dialog */}
      {userReadyToCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex p-8 items-center justify-center z-50 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-200 dark:border-purple-900">
            <button
              onClick={() => setUserReadyToCall(false)}
              className="absolute top-3 right-3 bg-gray-200 dark:bg-gray-700 p-1 w-8 h-8 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition-colors flex items-center justify-center"
            >
              <span className="sr-only">Close</span>
              <X className="w-4 h-4" />
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

        {currentRole === "hero" && callendfeedback && (
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
                    {typeof error === "string" ? error : error.message}
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

{incomingCallPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex p-8 items-center justify-center z-50 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-200 dark:border-purple-900">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4 mx-auto">
                <User className="w-8 h-8 text-purple-500 dark:text-purple-300" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Incoming Call {incomingCallName}</h3>
              {/* <p className="text-gray-600 dark:text-gray-400 text-sm">Rate your current mood before the call</p> */}
            </div>
            <button
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center transition-colors"
              onClick={() => {
                if (incomingCallRoom) acceptCallFromPromt(incomingCallRoom);
              }}
            >
              <Phone className="w-5 h-5 mr-2" />
              Start Call
            </button>
            <button
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center justify-center mt-5 transition-colors"
              onClick={() => {
                if (incomingCallRoom) endCallFromPromt(incomingCallRoom);
              }}
            >
              <Phone className="w-5 h-5 mr-2" />
              Decline Call
            </button>
          </div>
        </div>
      )}
      
      {/* User List */}
      {
        currentRole==="hero"?(<>
        {!connected && (<>
        {users.length > 0 ? (
        <div className="space-y-3">
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
                    <div className="bg-purple-100 dark:bg-purple-900 rounded-full mr-3">
                      {user.profilePicture ? (
                        <img className="w-12 h-12 rounded-full text-gray-400 dark:text-gray-500" src={user.profilePicture} alt={`${user.username}'s profile`} />
                      ) : (
                        <UserPlus className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{user.username}</h3>
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
                          Available for Session
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="flex items-center bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105"
                    onClick={() => handleUserReadyToCall(user.socketId, user.dbId, user.username)}
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
      </>) }
        </>):(<>
          {!connected && <>
          <div className="text-center bg-purple-100 dark:bg-gray-700 text-purple-800 dark:text-white p-4 rounded-lg shadow-md"> 
              Wait till your Hero contacts you...
          </div>
            </>}
        
        </>)
      }
      
      
    </div>
  );
};

export default Counter; 
