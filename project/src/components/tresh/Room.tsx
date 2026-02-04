import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../services/Peer";
import { useNavigate } from "react-router-dom";

import { useSocket } from "../context/SocketProvider";

interface IncommingCall {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface CallAccepted {
  from: string;
  ans: RTCSessionDescriptionInit;
}

interface NegoNeeded {
  from: string;
  offer: RTCSessionDescriptionInit;
}

const RoomPage: React.FC = () => {
  const socket = useSocket();
  const navigate = useNavigate();

  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const handleUserJoined = useCallback(({ email, id }: { email: string; id: string }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }: IncommingCall) => {
      try {
        setRemoteSocketId(from);
  
        if (peer.peer.signalingState !== "stable") {
          console.warn("Peer connection is not stable. Current state:", peer.peer.signalingState);
          return;
        }
  
        await peer.peer.setRemoteDescription(new RTCSessionDescription(offer));
  
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        console.log(`Incoming Call`, from, offer);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });
      } catch (error) {
        console.error("Error handling incoming call:", error);
      }
    },
    [socket]
  );

  // const sendStreams = useCallback(() => {
  //   if (myStream) {
  //     for (const track of myStream.getTracks()) {
  //       peer.peer.addTrack(track, myStream);
  //     }
  //   }
  // }, [myStream]); 

  const sendStreams = useCallback(() => {
    if (myStream) {
      const senders = peer.peer.getSenders();
      for (const track of myStream.getTracks()) {
        const alreadyAdded = senders.some((sender) => sender.track === track);
        if (!alreadyAdded) {
          peer.peer.addTrack(track, myStream);
        }
      }
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }: CallAccepted) => {     
        console.log(from);
          console.log(ans);
          
       peer.setLocalDescription(ans);
      console.log("Call Accepted!", ans);
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }: NegoNeeded) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }: { ans: RTCSessionDescriptionInit }) => {
    await peer.setLocalDescription(ans);
  }, []);

  // useEffect(() => {
  //   console.log("Adding track event listener");
  //   peer.peer.addEventListener("track", async (ev: RTCTrackEvent) => {
  //       console.log("Track event triggered:", ev);
  //     const remoteStream = ev.streams;
  //     if (remoteStream && remoteStream[0]) {
  //       console.log("Setting remote stream:", remoteStream[0]);
  //       setRemoteStream(remoteStream[0]);
  //     }
  //   });
  // }, []);

  useEffect(() => {
    console.log("Adding track event listener");
    peer.peer.addEventListener("track", (ev: RTCTrackEvent) => {
      console.log("Track event triggered:", ev);
      const [stream] = ev.streams; // Get the first stream from the event
      if (stream) {
        console.log("Setting remote stream:", stream);
        setRemoteStream(stream); // Set the remote stream
      }
    });
  
    return () => {
      peer.peer.removeEventListener("track", () => {});
    };
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  // navigate("/dashboard");

  return  (
    
    <div>
      <h1 className="text-3xl font-bold m-10">Welcome</h1>
      {/* <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>} */}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;