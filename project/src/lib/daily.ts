import DailyIframe from '@daily-co/daily-js';
import type { DailyCall } from '@daily-co/daily-js';
import { toast } from 'sonner';

let dailyCall: DailyCall | null = null;
let localStream: MediaStream | null = null;
let localVideo: HTMLVideoElement | null = null;

const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY;

// Log Daily.co operations (console only; no Supabase)
const logDailyEvent = (event: string, details: unknown = {}) => {
  console.log(`📝 Daily.co Event [${event}]:`, details);
};

async function createDailyRoom(sessionId: string) {
  try {
    console.log("[Daily] createDailyRoom start", { sessionId });
    await logDailyEvent('room_creation_start', { sessionId });

    // In development, use a test room
    if (import.meta.env.DEV) {
      // const url = `https://waqasjattroom.daily.co/waqasjattroom-${sessionId}`;
      const url = `https://waqasjattroom.daily.co/waqasjattroom`;
      console.log("[Daily] DEV mode – using test room", { url });
      await logDailyEvent('using_test_room', { sessionId });
      return {
        url,
        token: null
      };
    }

    // Create room with optimized settings
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`
      },
      credentials:'include',
      body: JSON.stringify({
        name: `session-${sessionId}`,
        privacy: 'private',
        properties: {
          max_participants: 2,
          enable_chat: true,
          enable_screenshare: false,
          enable_recording: false,
          exp: Math.floor(Date.now() / 1000) + 3600, // Expire in 1 hour
          eject_at_room_exp: true,
          start_video_off: false,
          start_audio_off: false,
          signaling_impl: 'ws', // Use WebSocket signaling
          enable_network_ui: false,
          enable_prejoin_ui: false,
          enable_people_ui: false,
          enable_pip_ui: false,
          max_bandwidth: 1500,
          audio_bitrate: 128,
          video_codec: 'vp8',
          simulcast: true,
          background_audio: false,
          background_video: false,
          geo: 'auto'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      await logDailyEvent('room_creation_error', error);
      throw new Error(error.info || 'Failed to create Daily room');
    }

    const data = await response.json();
    await logDailyEvent('room_created', data);

    // Create meeting token with specific permissions
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`
      },
      credentials:'include',
      body: JSON.stringify({
        properties: {
          room_name: data.name,
          exp: Math.floor(Date.now() / 1000) + 3600,
          is_owner: false,
          enable_screenshare: false,
          enable_recording: false,
          start_video_off: false,
          start_audio_off: false,
          enable_prejoin_ui: false
        }
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      await logDailyEvent('token_creation_error', error);
      throw new Error(error.info || 'Failed to create meeting token');
    }

    const tokenData = await tokenResponse.json();
    await logDailyEvent('token_created', { roomName: data.name });

    return {
      url: data.url,
      token: tokenData.token
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logDailyEvent('room_creation_failed', { error: message });
    throw error;
  }
}

export async function initializeLocalVideo(container: HTMLElement) {
  try {
    await logDailyEvent('local_video_init_start', {
      containerId: container.id
    });
    
    // First check if permissions are already granted
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error('Camera access is blocked. Please allow access in your browser settings.');
      }
    } catch (err) {
      console.warn('Could not check camera permissions:', err);
    }

    // Request camera/mic permissions with optimized constraints
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 30 }
      }, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      }
    });

    await logDailyEvent('camera_access_granted', {
      videoTracks: localStream.getVideoTracks().length,
      audioTracks: localStream.getAudioTracks().length
    });

    // Clean up existing video element if it exists
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.remove();
    }

    // Create video element
    localVideo = document.createElement('video');
    localVideo.id = 'local-video';
    localVideo.autoplay = true;
    localVideo.playsInline = true;
    localVideo.muted = true;
    localVideo.className = 'absolute bottom-4 right-4 w-1/4 aspect-video rounded-lg shadow-lg transform scale-x-[-1]';

    // Clear container and add video
    container.innerHTML = '';
    container.appendChild(localVideo);

    // Set local stream
    localVideo.srcObject = localStream;
    await localVideo.play().catch(console.error);

    await logDailyEvent('local_video_started', {
      videoId: localVideo.id
    });
    
    return localStream;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await logDailyEvent('local_video_error', {
      error: err.message,
      name: err.name
    });

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access was denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please ensure your camera is connected and working.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is in use by another application. Please close other apps using the camera.');
      }
    }
    throw error;
  }
}

export async function initializeDaily(container: HTMLElement, sessionId: string) {
  try {
    console.log("[Daily] initializeDaily start", { sessionId, containerId: container?.id });
    // Clean up any existing call
    if (dailyCall) {
      console.log("[Daily] cleaning up existing call");
      await logDailyEvent('cleanup_existing_call', { sessionId });
      dailyCall.leave();
      dailyCall.destroy();
      dailyCall = null;
    }

    await logDailyEvent('daily_init_start', {
      containerId: container.id,
      sessionId
    });
    
    // First, ensure container is empty
    container.innerHTML = '';
    console.log("[Daily] creating Daily iframe...");
    
    // Create new Daily call (Prebuilt iframe). sendSettings/receiveSettings are only for
    // call object mode, not createFrame — omit them to avoid "Invalid sendSettings" error.
    dailyCall = DailyIframe.createFrame(container, {
      showLeaveButton: false,
      showFullscreenButton: false,
      showParticipantsBar: false,
      iframeStyle: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '12px'
      }
    });

    // Set up event handlers with detailed logging
    dailyCall
      .on('loading', () => {
        logDailyEvent('iframe_loading', { sessionId });
      })
      .on('loaded', () => {
        logDailyEvent('iframe_loaded', { sessionId });
      })
      .on('joining-meeting', () => {
        logDailyEvent('joining_meeting', { sessionId });
      })
      .on('joined-meeting', (event) => {
        logDailyEvent('joined_meeting', {
          sessionId,
          participants: event?.participants
        });
        toast.success('Connected to video session');
      })
      .on('participant-joined', (event) => {
        logDailyEvent('participant_joined', {
          participant: event?.participant
        });
        toast.success('Your match has joined');
      })
      .on('participant-updated', (event) => {
        logDailyEvent('participant_updated', {
          participant: event?.participant
        });
      })
      .on('participant-left', (event) => {
        logDailyEvent('participant_left', {
          participant: event?.participant
        });
        toast.info('Your match has left');
      })
      .on('camera-error', (event) => {
        logDailyEvent('camera_error', event);
        toast.error('Failed to access camera. Please check your permissions and try again.');
      })
      .on('error', (error: unknown) => {
        logDailyEvent('daily_error', error);
        const msg =
          typeof error === 'object' && error !== null && 'errorMsg' in error
            ? String((error as { errorMsg?: string }).errorMsg)
            : error instanceof Error
              ? error.message
              : String(error);
        const isPaymentError = /account-missing-payment-method/i.test(msg);
        if (isPaymentError) {
          toast.error(
            'Video provider (Daily.co) requires a payment method on your account. Add one at dashboard.daily.co to enable video calls.',
            { duration: 8000 }
          );
        } else {
          toast.error('Video session error. Please refresh and try again.');
        }
      })
      .on('network-quality-change', (event) => {
        logDailyEvent('network_quality_change', {
          quality: event?.quality,
          threshold: event?.threshold
        });
      })
      .on('network-connection', (event) => {
        const ev = event as { type?: string; message?: string };
        logDailyEvent('network_connection', {
          type: ev?.type,
          message: ev?.message
        });
      });

    // Create room and join the call
    await logDailyEvent('creating_room', { sessionId });
    console.log("[Daily] createDailyRoom...");
    const { url, token } = await createDailyRoom(sessionId);
    console.log("[Daily] room ready", { url: url?.substring(0, 50) + "...", hasToken: !!token });
    
    await logDailyEvent('joining_room', { url });

    // Add a small delay before joining to ensure room is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("[Daily] joining call...");

    const joinOptions: { url: string; token?: string; audioSource: boolean; videoSource: boolean } = {
      url,
      audioSource: true,
      videoSource: true
    };
    if (typeof token === 'string' && token.length > 0) {
      joinOptions.token = token;
    }
    await dailyCall.join(joinOptions);

    console.log("[Daily] join() completed successfully");
    await logDailyEvent('daily_initialized', { sessionId });
    return dailyCall;
  } catch (error) {
    console.error("[Daily] initializeDaily error", error);
    const message = error instanceof Error ? error.message : String(error);
    await logDailyEvent('daily_init_error', {
      error: message,
      sessionId
    });
    throw error;
  }
}

export function toggleVideo(enabled: boolean) {
  if (!dailyCall) return;
  
  try {
    logDailyEvent('toggle_video', { enabled });
    dailyCall.setLocalVideo(enabled);
    toast.info(`Camera ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDailyEvent('toggle_video_error', { error: message });
    throw error;
  }
}

export function toggleAudio(enabled: boolean) {
  if (!dailyCall) return;
  
  try {
    logDailyEvent('toggle_audio', { enabled });
    dailyCall.setLocalAudio(enabled);
    toast.info(`Microphone ${enabled ? 'unmuted' : 'muted'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDailyEvent('toggle_audio_error', { error: message });
    throw error;
  }
}

export function setVolume(volume: number) {
  if (!dailyCall) return;
  const call = dailyCall as DailyCall & { setOutputVolume?: (v: number) => void };
  try {
    logDailyEvent('set_volume', { volume });
    if (typeof call.setOutputVolume === 'function') {
      call.setOutputVolume(volume);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDailyEvent('set_volume_error', { error: message });
    throw error;
  }
}

export async function cleanupDaily() {
  try {
    await logDailyEvent('cleanup_start', {});
    
    // Stop local video playback
    if (localVideo) {
      localVideo.pause();
      localVideo.srcObject = null;
      localVideo = null;
    }

    // Stop local media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        logDailyEvent('track_stopped', { kind: track.kind });
      });
      localStream = null;
    }
    
    // Cleanup Daily.co call
    if (dailyCall) {
      await logDailyEvent('leaving_call', {});
      dailyCall.leave();
      
      await logDailyEvent('destroying_instance', {});
      dailyCall.destroy();
      dailyCall = null;
    }
    
    await logDailyEvent('cleanup_complete', {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logDailyEvent('cleanup_error', { error: message });
  }
}