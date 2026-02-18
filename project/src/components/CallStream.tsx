import { useState, useEffect, useRef } from 'react';
import { connect, Room, RemoteParticipant, RemoteTrack, RemoteTrackPublication, LocalTrackPublication } from 'twilio-video';

const TwilioVideoCall = () => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [participantIdentity, setParticipantIdentity] = useState('');
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [roomNameInput, setRoomNameInput] = useState('');
  const [incomingRoomInput, setIncomingRoomInput] = useState('');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const API_BASE = import.meta.env.VITE_SERVER_URI || 'http://localhost:4000';

  // Helper function to get a token from your backend (uses Twilio API keys on server)
  const getToken = async (identity: string, roomName?: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE}/api/get-twilio-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ identity, roomName }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Token request failed: ${response.status}`);
      }
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting token:', error);
      setStatus('disconnected');
      throw error;
    }
  };

  // Handle incoming participant
  const handleParticipantConnected = (participant: RemoteParticipant) => {
    setParticipantIdentity(participant.identity);
    setParticipants(prevParticipants => [...prevParticipants, participant]);

    // Handle participant's video tracks
    participant.tracks.forEach((publication: RemoteTrackPublication) => {
      if (publication.isSubscribed && publication.track) {
        handleTrackSubscribed(publication.track, participant);
      }
    });

    // Listen for track subscription events
    participant.on('trackSubscribed', (track: RemoteTrack) => {
      handleTrackSubscribed(track, participant);
    });
  };

  // Handle disconnection
  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    setParticipants(prevParticipants => {
      const newList = prevParticipants.filter(p => p !== participant);
      if (newList.length === 0) {
        setParticipantIdentity('');
      }
      return newList;
    });
  };

  // Handle track subscription
  const handleTrackSubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
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
  const initiateCall = async (roomName: string) => {
    try {
      setConnecting(true);
      setStatus('connecting');

      // Get token from your backend (Twilio credentials on server)
      const identity = `user-${Math.floor(Math.random() * 1000)}`;
      const token = await getToken(identity, roomName);

      // Connect to room
      const newRoom = await connect(token, {
        name: roomName,
        audio: true,
        video: { width: 640 },
      });

      // Set up local video
      newRoom.localParticipant.tracks.forEach((publication: LocalTrackPublication) => {
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
  const acceptCall = async (roomName: string) => {
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
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              placeholder="Enter room name" 
              className="px-3 py-2 border rounded-md"
            />
            <button
              onClick={() => initiateCall(roomNameInput)}
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
              value={incomingRoomInput}
              onChange={(e) => setIncomingRoomInput(e.target.value)}
              placeholder="Room to join" 
              className="px-3 py-2 border rounded-md"
            />
            <button
              onClick={() => acceptCall(incomingRoomInput)}
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