import React, { useState, useEffect, useRef } from 'react';
import { Video } from 'twilio-video';

// IMPORTANT: Replace these with your Twilio credentials in your actual code
// DO NOT commit these to version control or share them publicly
const TWILIO_CONFIG = {
  twilioSid: 'AC3ed999b61a7ef14a303e542d53633020', // Replace with your SID
  twilioAuth: 'b487d720019b4b98b805eb570f6d100b', // Replace with your Auth token
  twilioServicesSid: 'VAd7d71767f28fcbf92d5cfd16638afccf' // Replace with your Services SID
};

const TwilioVideoCall = () => {
  const [room, setRoom] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [participantIdentity, setParticipantIdentity] = useState('');
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  // Helper function to get a token from your backend
  const getToken = async (identity) => {
    try {
      // In production, you should have a server endpoint that generates tokens
      // This is just a placeholder - you need to implement this on your backend
      const response = await fetch('/api/get-twilio-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity }),
      });

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting token:', error);
      setStatus('disconnected');
      throw error;
    }
  };

  // Handle incoming participant
  const handleParticipantConnected = (participant) => {
    setParticipantIdentity(participant.identity);
    setParticipants(prevParticipants => [...prevParticipants, participant]);

    // Handle participant's video tracks
    participant.tracks.forEach(publication => {
      if (publication.isSubscribed) {
        handleTrackSubscribed(publication.track, participant);
      }
    });

    // Listen for track subscription events
    participant.on('trackSubscribed', track => {
      handleTrackSubscribed(track, participant);
    });
  };

  // Handle disconnection
  const handleParticipantDisconnected = (participant) => {
    setParticipants(prevParticipants => 
      prevParticipants.filter(p => p !== participant)
    );
    if (participants.length === 0) {
      setParticipantIdentity('');
    }
  };

  // Handle track subscription
  const handleTrackSubscribed = (track, participant) => {
    if (track.kind === 'video') {
      if (remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
    } else if (track.kind === 'audio') {
      // Attach audio track to the DOM
      const audioElement = document.createElement('audio');
      audioElement.id = `audio-${participant.sid}`;
      document.body.appendChild(audioElement);
      track.attach(audioElement);
    }
  };

  // Initiate call
  const initiateCall = async (roomName) => {
    try {
      setConnecting(true);
      setStatus('connecting');

      // Get token from your backend
      const identity = `user-${Math.floor(Math.random() * 1000)}`;
      const token = await getToken(identity);

      // Connect to room
      const newRoom = await Video.connect(token, {
        name: roomName,
        audio: true,
        video: { width: 640 },
      });

      // Set up local video
      newRoom.localParticipant.tracks.forEach(publication => {
        if (publication.track.kind === 'video' && localVideoRef.current) {
          publication.track.attach(localVideoRef.current);
        }
      });

      // Handle participants
      newRoom.participants.forEach(handleParticipantConnected);
      newRoom.on('participantConnected', handleParticipantConnected);
      newRoom.on('participantDisconnected', handleParticipantDisconnected);

      setRoom(newRoom);
      setStatus('connected');
      setConnecting(false);
    } catch (error) {
      console.error('Error connecting to Twilio:', error);
      setStatus('disconnected');
      setConnecting(false);
    }
  };

  // Accept incoming call
  const acceptCall = async (roomName) => {
    await initiateCall(roomName);
  };

  // End call
  const endCall = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setParticipants([]);
      setStatus('disconnected');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl p-4 mx-auto bg-gray-100 rounded-lg shadow-md">
      <h2 className="mb-4 text-xl font-bold text-center">Twilio Video Call</h2>
      
      {/* Connection status */}
      <div className="mb-4 p-2 rounded bg-gray-200">
        <p className="text-center">
          Status: <span className="font-medium">{status}</span>
          {participantIdentity && (
            <span> - Connected with: {participantIdentity}</span>
          )}
        </p>
      </div>
      
      {/* Call controls */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {status === 'disconnected' && (
          <div className="flex gap-2">
            <input 
              type="text" 
              id="roomName" 
              placeholder="Enter room name" 
              className="px-3 py-2 border rounded-md"
            />
            <button
              onClick={() => initiateCall(document.getElementById('roomName').value)}
              disabled={connecting}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {connecting ? 'Connecting...' : 'Start Call'}
            </button>
          </div>
        )}
        
        {status === 'disconnected' && (
          <div className="flex gap-2">
            <input 
              type="text" 
              id="incomingRoom" 
              placeholder="Room to join" 
              className="px-3 py-2 border rounded-md"
            />
            <button
              onClick={() => acceptCall(document.getElementById('incomingRoom').value)}
              disabled={connecting}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Join Call
            </button>
          </div>
        )}
        
        {status === 'connected' && (
          <button
            onClick={endCall}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            End Call
          </button>
        )}
      </div>
      
      {/* Video streams */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Local video */}
        <div className="w-full md:w-1/2">
          <p className="mb-2 font-medium text-center">Your Video</p>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        {/* Remote video */}
        <div className="w-full md:w-1/2">
          <p className="mb-2 font-medium text-center">Remote Video</p>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {participants.length > 0 ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                No remote participant
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwilioVideoCall;