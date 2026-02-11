import io from "socket.io-client";

const socket = io(`http://localhost:4000`, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
});
export default socket;