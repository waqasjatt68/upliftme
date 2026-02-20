import { connect, Room, RemoteParticipant, RemoteTrack, RemoteTrackPublication, LocalTrackPublication } from 'twilio-video';

const API_BASE = import.meta.env.VITE_SERVER_URI || 'http://localhost:4000';

let room: Room | null = null;
let localStream: MediaStream | null = null;
let localVideoEl: HTMLVideoElement | null = null;
let remoteVideoEl: HTMLVideoElement | null = null;
const remoteAudioEls: HTMLAudioElement[] = [];

type EventMap = {
  'participant-joined': () => void;
  'participant-left': () => void;
};
const listeners: { [K in keyof EventMap]?: EventMap[K][] } = {};

function emit(event: keyof EventMap) {
  (listeners[event] || []).forEach((fn) => fn());
}

/** Client-like object so VideoSession can use .on('participant-joined' | 'participant-left') */
function getClient() {
  return {
    on(ev: keyof EventMap, fn: () => void) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev]!.push(fn);
      return getClient();
    },
    get room() {
      return room;
    },
  };
}

async function getToken(identity: string, roomName: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/get-twilio-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identity, roomName }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Token failed: ${response.status}`);
  }
  const data = await response.json();
  return data.token;
}

export async function initializeLocalVideo(container: HTMLElement): Promise<MediaStream> {
  try {
    const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null);
    if (permissions?.state === 'denied') {
      throw new Error('Camera access is blocked. Please allow access in your browser settings.');
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    if (localVideoEl) {
      localVideoEl.srcObject = null;
      localVideoEl.remove();
    }
    localVideoEl = document.createElement('video');
    localVideoEl.id = 'local-video';
    localVideoEl.autoplay = true;
    localVideoEl.playsInline = true;
    localVideoEl.muted = true;
    localVideoEl.className = 'video-session-local';

    container.innerHTML = '';
    container.appendChild(localVideoEl);
    localVideoEl.srcObject = localStream;
    await localVideoEl.play().catch(console.error);
    return localStream;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') throw new Error('Camera access was denied. Please allow access and try again.');
      if (err.name === 'NotFoundError') throw new Error('No camera found. Please ensure your camera is connected and working.');
      if (err.name === 'NotReadableError') throw new Error('Camera is in use by another application. Please close other apps using the camera.');
    }
    throw err;
  }
}

export async function initializeVideo(container: HTMLElement, sessionId: string) {
  if (room) {
    room.disconnect();
    room = null;
  }
  // Release preview stream so Twilio can use camera/mic
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (localVideoEl) {
    localVideoEl.srcObject = null;
    localVideoEl = null;
  }

  const roomName = `session-${sessionId}`;
  const identity = `user-${sessionId}-${Date.now()}`;
  const token = await getToken(identity, roomName);

  console.log('[Twilio] Connecting to room:', roomName, 'with identity:', identity);
  room = await connect(token, {
    name: roomName,
    audio: true,
    video: { width: 640 },
  });

  console.log('[Twilio] Connected to room. State:', room.state, 'Participants:', room.participants.size);
  
  // Log all existing participants immediately
  if (room.participants.size > 0) {
    console.log('[Twilio] Found', room.participants.size, 'existing participant(s)');
    room.participants.forEach((p) => {
      console.log('[Twilio] - Participant:', p.identity, 'SID:', p.sid, 'Tracks:', p.tracks.size);
    });
  }

  container.innerHTML = '';
  
  // Create remote video container and element
  const remoteWrap = document.createElement('div');
  remoteWrap.className = 'video-session-remote-wrap';
  remoteVideoEl = document.createElement('video');
  remoteVideoEl.autoplay = true;
  remoteVideoEl.playsInline = true;
  remoteVideoEl.className = 'video-session-remote';
  remoteVideoEl.setAttribute('playsinline', 'true');
  remoteVideoEl.srcObject = null;
  remoteVideoEl.setAttribute('data-role', 'remote');
  remoteVideoEl.style.opacity = '0'; // hidden until remote track attaches (stops local showing in main area)
  remoteWrap.appendChild(remoteVideoEl);

  // Create local video container and element
  const localWrap = document.createElement('div');
  localWrap.className = 'video-session-local-wrap';
  const localV = document.createElement('video');
  localV.autoplay = true;
  localV.playsInline = true;
  localV.muted = true;
  localV.className = 'video-session-local';
  localV.setAttribute('playsinline', 'true');
  localWrap.appendChild(localV);

  // Append to container (remote first so it's behind local)
  container.appendChild(remoteWrap);
  container.appendChild(localWrap);
  
  console.log('[Twilio] Video elements created and added to DOM');

  // Attach local participant's video track ONLY to localV (PIP). Never to remoteVideoEl.
  room.localParticipant.tracks.forEach((pub: LocalTrackPublication) => {
    if (pub.track?.kind === 'video') {
      pub.track.attach(localV);
      console.log('[Twilio] Local video track attached to local PIP only');
      localV.play().catch(err => console.warn('[Twilio] Failed to play local video:', err));
    }
  });

  // Also listen for local track publications – only ever attach to localV
  room.localParticipant.on('trackPublished', (publication: LocalTrackPublication) => {
    if (publication.track?.kind === 'video') {
      publication.track.attach(localV);
      console.log('[Twilio] Local video track published and attached to local PIP only');
      localV.play().catch(err => console.warn('[Twilio] Failed to play local video:', err));
    }
  });

  const handleTrackSubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
    console.log('[Twilio] Track subscribed:', track.kind, 'from participant:', participant.identity);
    if (track.kind === 'video' && remoteVideoEl) {
      try {
        track.attach(remoteVideoEl);
        remoteVideoEl.style.opacity = '1'; // show only when we have a real remote track
        console.log('[Twilio] Remote video track attached to element');
        // Force play in case autoplay is blocked
        remoteVideoEl.play().catch(err => console.warn('[Twilio] Failed to play remote video:', err));
      } catch (err) {
        console.error('[Twilio] Error attaching remote video track:', err);
      }
    } else if (track.kind === 'audio') {
      const audioEl = document.createElement('audio');
      audioEl.id = `audio-${participant.sid}`;
      audioEl.autoplay = true;
      container.appendChild(audioEl);
      remoteAudioEls.push(audioEl);
      track.attach(audioEl);
      console.log('[Twilio] Remote audio track attached');
    }
  };

  // Function to attach all available remote tracks (useful for retry)
  const attachAllRemoteTracks = () => {
    if (!remoteVideoEl || !room) {
      console.warn('[Twilio] Remote video element or room not ready');
      return;
    }
    console.log('[Twilio] attachAllRemoteTracks: Checking', room.participants.size, 'participant(s)');
    if (room.participants.size === 0) {
      console.log('[Twilio] No participants found in room');
      return;
    }
    room.participants.forEach((p: RemoteParticipant) => {
      console.log('[Twilio] Checking participant:', p.identity, 'with', p.tracks.size, 'tracks');
      p.tracks.forEach((pub: RemoteTrackPublication) => {
        console.log('[Twilio] - Track:', pub.kind, 'isSubscribed:', pub.isSubscribed, 'hasTrack:', !!pub.track);
        if (pub.isSubscribed && pub.track && pub.track.kind === 'video') {
          try {
            // Try to attach - attach() is idempotent, safe to call multiple times
            pub.track.attach(remoteVideoEl!);
            remoteVideoEl!.style.opacity = '1'; // show only when we have a real remote track
            console.log('[Twilio] ✓ Attached remote video track from:', p.identity);
            remoteVideoEl!.play().catch(err => console.warn('[Twilio] Failed to play remote video:', err));
          } catch (err) {
            console.error('[Twilio] Error attaching remote track:', err);
          }
        }
      });
    });
  };

  // Handle existing participants in the room (when we join and they're already there)
  if (room.participants.size > 0) {
    console.log('[Twilio] ===== FOUND EXISTING PARTICIPANTS ON JOIN =====');
    // Emit participant-joined event so timer starts (important for uplifter joining after hero)
    emit('participant-joined');
  }
  
  room.participants.forEach((p: RemoteParticipant) => {
    console.log('[Twilio] Found existing participant:', p.identity, 'with', p.tracks.size, 'tracks');
    // Handle already subscribed tracks
    p.tracks.forEach((pub: RemoteTrackPublication) => {
      if (pub.isSubscribed && pub.track) {
        console.log('[Twilio] Existing track is subscribed:', pub.track.kind);
        handleTrackSubscribed(pub.track, p);
      } else {
        console.log('[Twilio] Existing track not yet subscribed:', pub.kind, 'isSubscribed:', pub.isSubscribed);
      }
    });
    // Listen for future track subscriptions (tracks auto-subscribe, this event fires when ready)
    p.on('trackSubscribed', (track: RemoteTrack) => {
      console.log('[Twilio] Track subscribed event for existing participant:', p.identity, track.kind);
      handleTrackSubscribed(track, p);
    });
    // Also listen for track publications in case tracks are published after we check
    p.on('trackPublished', (publication: RemoteTrackPublication) => {
      console.log('[Twilio] Track published for existing participant:', p.identity, publication.kind);
      // Track will auto-subscribe, wait for trackSubscribed event
      // But if it's already subscribed, handle it immediately
      if (publication.isSubscribed && publication.track) {
        handleTrackSubscribed(publication.track, p);
      }
    });
  });

  // Handle new participants joining (when they join after us)
  room.on('participantConnected', (participant: RemoteParticipant) => {
    console.log('[Twilio] ===== PARTICIPANT CONNECTED EVENT =====');
    console.log('[Twilio] Participant connected:', participant.identity, 'SID:', participant.sid);
    console.log('[Twilio] Participant has', participant.tracks.size, 'track(s)');
    emit('participant-joined');
    
    // Handle tracks that are already subscribed when they join
    participant.tracks.forEach((pub: RemoteTrackPublication) => {
      console.log('[Twilio] Participant track:', pub.kind, 'isSubscribed:', pub.isSubscribed, 'hasTrack:', !!pub.track);
      if (pub.isSubscribed && pub.track) {
        console.log('[Twilio] New participant track is subscribed:', pub.track.kind);
        handleTrackSubscribed(pub.track, participant);
      } else {
        console.log('[Twilio] New participant track not yet subscribed:', pub.kind, 'isSubscribed:', pub.isSubscribed);
      }
    });
    
    // Listen for track subscriptions (tracks auto-subscribe, this event fires when ready)
    participant.on('trackSubscribed', (track: RemoteTrack) => {
      console.log('[Twilio] ===== TRACK SUBSCRIBED EVENT =====');
      console.log('[Twilio] Track subscribed event for new participant:', participant.identity, track.kind);
      handleTrackSubscribed(track, participant);
    });
    
    // Listen for track publications
    participant.on('trackPublished', (publication: RemoteTrackPublication) => {
      console.log('[Twilio] Track published for new participant:', participant.identity, publication.kind);
      // Track will auto-subscribe, wait for trackSubscribed event
      // But if it's already subscribed, handle it immediately
      if (publication.isSubscribed && publication.track) {
        handleTrackSubscribed(publication.track, participant);
      }
    });
    
    // Also check tracks after a short delay in case they weren't ready immediately
    setTimeout(() => {
      console.log('[Twilio] Delayed check for participant tracks:', participant.identity);
      participant.tracks.forEach((pub: RemoteTrackPublication) => {
        if (pub.isSubscribed && pub.track) {
          console.log('[Twilio] Found track in delayed check, ensuring attached:', pub.track.kind);
          handleTrackSubscribed(pub.track, participant);
        }
      });
      // Also trigger a full retry
      attachAllRemoteTracks();
    }, 500);
  });

  // Track previous participant count to detect new participants
  let lastParticipantCount = room.participants.size;
  let hasEmittedParticipantJoined = room.participants.size > 0;
  
  // Periodic check for new participants and tracks (in case events don't fire)
  const participantCheckInterval = setInterval(() => {
    if (!room) {
      clearInterval(participantCheckInterval);
      return;
    }
    const currentCount = room.participants.size;
    
    // If we have participants but haven't emitted the event yet, do it now
    if (currentCount > 0 && !hasEmittedParticipantJoined) {
      console.log('[Twilio] First participant(s) detected via periodic check, emitting participant-joined');
      emit('participant-joined');
      hasEmittedParticipantJoined = true;
    }
    
    if (currentCount !== lastParticipantCount) {
      console.log('[Twilio] Participant count changed:', lastParticipantCount, '->', currentCount);
      
      // If count increased, emit participant-joined event (if not already emitted)
      if (currentCount > lastParticipantCount && !hasEmittedParticipantJoined) {
        console.log('[Twilio] New participant detected via periodic check, emitting participant-joined');
        emit('participant-joined');
        hasEmittedParticipantJoined = true;
      }
      
      lastParticipantCount = currentCount;
      
      // Check for new participants that might not have triggered the event
      room.participants.forEach((p: RemoteParticipant) => {
        console.log('[Twilio] Periodic check - Participant:', p.identity, 'Tracks:', p.tracks.size);
        p.tracks.forEach((pub: RemoteTrackPublication) => {
          if (pub.isSubscribed && pub.track && pub.track.kind === 'video') {
            console.log('[Twilio] Periodic check - Found video track, ensuring attached');
            handleTrackSubscribed(pub.track, p);
          }
        });
      });
    }
    
    // Always try to attach any available tracks
    attachAllRemoteTracks();
  }, 2000); // Check every 2 seconds
  
  // Retry attaching tracks after short delays to catch any timing issues
  setTimeout(() => {
    console.log('[Twilio] Retry 1s: Checking for missed remote tracks');
    attachAllRemoteTracks();
  }, 1000);
  
  setTimeout(() => {
    console.log('[Twilio] Retry 3s: Checking for missed remote tracks');
    attachAllRemoteTracks();
  }, 3000);
  
  // Also retry when room state changes to 'connected'
  room.on('reconnected', () => {
    console.log('[Twilio] Room reconnected, re-attaching tracks');
    attachAllRemoteTracks();
  });
  
  // Clean up interval when room disconnects
  room.on('disconnected', () => {
    console.log('[Twilio] Room disconnected, clearing participant check interval');
    clearInterval(participantCheckInterval);
  });

  room.on('participantDisconnected', () => {
    emit('participant-left');
  });

  return getClient();
}

export function toggleVideo(enabled: boolean) {
  if (!room) return;
  room.localParticipant.videoTracks.forEach((pub) => {
    if (pub.track) pub.track.enable(enabled);
  });
}

export function toggleAudio(enabled: boolean) {
  if (!room) return;
  room.localParticipant.audioTracks.forEach((pub) => {
    if (pub.track) pub.track.enable(enabled);
  });
}

export function setVolume(volume: number) {
  remoteAudioEls.forEach((el) => {
    el.volume = Math.max(0, Math.min(1, volume));
  });
}

export async function cleanupVideo() {
  if (localVideoEl) {
    localVideoEl.srcObject = null;
    localVideoEl = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  remoteAudioEls.length = 0;
  remoteVideoEl = null;
  if (room) {
    room.disconnect();
    room = null;
  }
  listeners['participant-joined'] = [];
  listeners['participant-left'] = [];
}
