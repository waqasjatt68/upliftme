import io from "socket.io-client";
// const serverUri = import.meta.env.VITE_SERVER_URI;
const socket = io(`https://www.upliftmee.com`, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
});
export default socket;