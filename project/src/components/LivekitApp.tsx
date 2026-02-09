'use client';

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
} from '@livekit/components-react';
// import { AccessToken } from 'livekit-server-sdk'; // (Only for local testing!)
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState } from 'react';

// LiveKit Server URL
const serverUrl = 'wss://uplifmee-1l4lk2qd.livekit.cloud';

// Your LiveKit API credentials (should not be here in production!)
// const apiKey = 'APItSDnBLzLn8Y4';
// const apiSecret = 'BUT9ZQcHHWKto2YZjm7Wb4xiVbmhYfs0zc3dCvRdfRF'; // <<< PUT your real secret here

// Hardcoded for testing
const roomName = 'test-room'; 

export default function LiveKitApp() {
  const [room] = useState<Room>(() => new Room({
    adaptiveStream: true,
    dynacast: true,
  }));

  const [identity, setIdentity] = useState<string>('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      if (!identity) return; // Wait until identity is set

      const response = await fetch('http://localhost:4000/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity, roomName }),
      });

      const data = await response.json();
      console.log("Generated Token:", data.token);
      if (mounted) {
        await room.connect(serverUrl, data.token);
        setConnected(true);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (room.state === 'connected' || room.state === 'connecting') {
        room.disconnect();
      }
    };
  }, [room, identity]);

  return (
    <RoomContext.Provider value={room}>
      {!connected ? (
        <div style={{ padding: 20 }}>
          <h2>Join Room</h2>
          <input
            type="text"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="Enter your name"
          />
          <button onClick={() => {}} disabled={!identity}>
            Connecting...
          </button>
        </div>
      ) : (
        <div data-lk-theme="default" style={{ height: '100vh' }}>
          <MyVideoConference />
          <RoomAudioRenderer />
          <ControlBar />
        </div>
      )}
    </RoomContext.Provider>
  );
}

function MyVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout
      tracks={tracks}
      style={{ height: 'calc(100vh - var(--lk-control-bar-height))' }}
    >
      <ParticipantTile />
    </GridLayout>
  );
}


// inhance code by claude
