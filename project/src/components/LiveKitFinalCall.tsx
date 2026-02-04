import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import socket from '../lib/socket';
import UserList from '../components/UsersList'

interface User {
    username: string;
    socketId: string;
    role: string;
    dbId: string;
    state: string;
    rating: number;
    profilePicture:string;
  }

const Counter: React.FC = () => {
    // const [dbId, setDbId] = useState<string | null>(null)
    const {dbId, currentRole,profilePicture, rating ,userName} = useSessionStore()
    const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    socket.connect();

    socket.emit("registerUser",{
        username: userName,
        dbid: dbId,
        role: currentRole,
        rating: rating || 5,
        profilePicture:profilePicture,
    })
  },[currentRole,rating])
  useEffect(()=>{
    socket.on("usersList", (data) => {
        // Handle the user registered event
      setUsers(data)
      });
  },[])
//   console.log(users);
  
  return (
<div className=" dark:bg-gray-700 p-2 rounded-xl shadow-md">
  <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-4">
    {userName}
  </h1>
 
    <UserList />
 

</div>
  ) 
};

export default Counter;
