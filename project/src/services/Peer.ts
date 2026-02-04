class PeerService {
  public peer: RTCPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:global.stun.twilio.com:3478",
        ],
      },
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
      },
    ],
  });

  constructor() {
  
    this.resetConnection();
  }

  createPeerConnection() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
        },
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        },
      ],
    });
    
    return this.peer;
  }

  async getAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (this.peer.signalingState !== "stable") {
      await Promise.all([
        this.peer.setLocalDescription({type: "rollback"}),
        this.peer.setRemoteDescription(offer)
      ]);
    } else {
      await this.peer.setRemoteDescription(offer);
    }
    
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (this.peer.signalingState === "have-local-offer" && desc.type === "answer") {
      await this.peer.setRemoteDescription(desc);
    } else {
      await this.peer.setLocalDescription(desc);
    }
  }

  async getOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return offer;
  }

  closeConnection() {
    if (this.peer) {
      this.peer.close();
    }
  }

  resetConnection() {
    this.closeConnection();
    return this.createPeerConnection();
  }
}

const peer = new PeerService();
export default peer;