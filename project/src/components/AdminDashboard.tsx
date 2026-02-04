import React, { useEffect, useState } from 'react';
import { Users, Activity, CreditCard, Star } from 'lucide-react';
import { useSessionStore } from '../store/session';
import socket from '../lib/socket';
import UsersFormAdmin from './UsersForAdmin'
interface UserStats {
  totalUsers: number;
  heroUsers: number;
  uplifterUsers: number;
  totalSessions: number;
  averageRating: number;
  total_revenue: number;
  total_users: number;
  total_sessions: number;
  total_uplifters: number;
}

interface Session {
  id: string;
  hero: { userName: string } | null;
  uplifter: { userName: string } | null;
  duration: number | null;
  status: string;
  ratingGiven?: number;
  amount_paid: number;
  dateTime: string;
  feedback: string;
}

const AdminDashboard: React.FC = () => {
  const { currentRole } = useSessionStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [activeCalls, setActiveCalls] = useState<number>(0);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.emit("getUsers");

    const handleOnlineUsers = (users:number) => setOnlineUsers(users);
    const handleActiveCalls = (calls:number) => setActiveCalls(calls);

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("activeCalls", handleActiveCalls);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("activeCalls", handleActiveCalls);
    };
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch("https://www.upliftmee.com/api/admin/deshboardStats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setStats(data.userStats);
      setRecentSessions(data.recentSessions);
      // console.log(data.recentSessions);

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-xl font-bold">Access Denied</h1>
      </div>
    );
  }

  // console.log(recentSessions);


  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-8">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Users</h3>
            <Users className="w-6 h-6 text-purple-500" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-3xl font-bold">{stats?.totalUsers ? stats.totalUsers - 1 : 0}</div>
              <div className="text-sm text-gray-500">Total Users</div>
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-semibold">{stats?.heroUsers || 0}</div>
                <div className="text-gray-500">Heroes</div>
              </div>
              <div>
                <div className="font-semibold">{stats?.uplifterUsers || 0}</div>
                <div className="text-gray-500">Uplifters</div>
              </div>
              <div>
                <div className="font-semibold">{onlineUsers || 0}</div>
                <div className="text-gray-500">Online</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Sessions</h3>
            <Activity className="w-6 h-6 text-blue-500" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-3xl font-bold">{stats?.totalSessions || 0}</div>
              <div className="text-sm text-gray-500">Total Sessions</div>
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-semibold">{activeCalls}</div>
                <div className="text-gray-500">Active</div>
              </div>
              <div>
                <div className="font-semibold">{stats?.averageRating?.toFixed(1) || '0.0'}</div>
                <div className="text-gray-500">Avg Rating</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Revenue</h3>
            <CreditCard className="w-6 h-6 text-green-500" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-3xl font-bold">${((stats?.total_revenue || 0) / 100).toFixed(2)}</div>
              <div className="text-sm text-gray-500">Total Revenue</div>
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-semibold">${((stats?.total_revenue || 0) * 0.9 / 100).toFixed(2)}</div>
                <div className="text-gray-500">Uplifter Earnings</div>
              </div>
              <div>
                <div className="font-semibold">{stats?.total_uplifters || 0}</div>
                <div className="text-gray-500">Active Uplifters</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Quick Stats</h3>
            <Star className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Conversion Rate</div>
              <div className="font-semibold">{stats?.total_users ? ((stats.total_sessions / stats.total_users) * 100).toFixed(1) : '0'}%</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Avg Revenue/User</div>
              <div className="font-semibold">${stats?.total_users ? ((stats.total_revenue / 100) / stats.total_users).toFixed(2) : '0.00'}</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Avg Sessions/Day</div>
              <div className="font-semibold">{Math.round((stats?.total_sessions || 0) / 30)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="pb-4">Hero</th>
                <th className="pb-4">Uplifter</th>
                <th className="pb-4">Status</th>
                <th className="pb-4">Duration</th>
                <th className="pb-4">Rating</th>
                <th className="pb-4">Feedback</th>
                <th className="pb-4">Amount</th>
                <th className="pb-4">Date</th>
                <th className="pb-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((session, index) => (
                <tr key={index} className="border-t dark:border-gray-700">
                  <td className="py-3">{session.hero?.userName || 'Unknown'}</td>
                  <td className="py-3">{session.uplifter?.userName || 'Unknown'}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${session.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {session.status==="completed" && session.duration !== null
                      ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
                      : (
                        
                          session.status === 'declined' ? (
                            <>-</>
                          ) : (
                            " In Progress"
                          )
                        
                     
                      )
                      }
                  </td>
                  <td className="py-3">
                    {session.ratingGiven !== undefined ? (
                      <div className="flex items-center">
                        {Array.from({ length: session.ratingGiven }).map((_, index) => (
                          <Star key={index} className="w-4 h-4 text-yellow-500 fill-current" />
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 max-w-xs break-words overflow-hidden text-ellipsis" title={session.feedback}>
                    {session.feedback ? (
                      <span className="ml-1">{session.feedback}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3">${((session.amount_paid || 0) / 100).toFixed(2)}</td>
                  <td className="py-3">
                    {session.dateTime ? (
                      <span>{new Date(session.dateTime).toLocaleDateString()}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3">
                    {session.dateTime ? (
                      <span>{new Date(session.dateTime).toLocaleTimeString()}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>




      <div className="bg-white dark:bg-gray-800 rounded-xl mt-8 shadow-lg p-6">
        <UsersFormAdmin />
      </div>
    </div>
  );
};

export default AdminDashboard;