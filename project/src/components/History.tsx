import { useSessionStore } from '../store/session';
import React, { useEffect, useState } from 'react';
import { Star, Calendar, Clock, User, ChevronLeft, ChevronRight, MessageSquare, LineChart, Loader, Flag, ArrowUp, ArrowDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface SessionHistory {
  id: string;
  started_at: string;
  ended_at: string;
  userStats: [];
  dbId: string;
  rating: number;
  hero: { username: string; avatar_url: string } | null;
  uplifter: { username: string; avatar_url: string } | null;
  amount_paid: number;
  message: string;
  note: string;
  emotional_tracking: Array<{
    score: number;
    type: 'pre_session' | 'post_session';
  }>;
}

interface Session {
  _id: string;
  heroId: string;
  heros?: Uplifter[];
  uplifterId: string;
  startTime: string;
  endTime?: string;
  status?: string;
  feedback: string;
  initialMood?: number;
  finalMood?: number;
  duration?: number;
  paymentStatus?: string;
  ratingGiven?: number;
  inappropriate?: boolean;
  uplifters?: Uplifter[];
}

interface Uplifter {
  _id: string;
  email: string;
  userName: string;
  role: string;
  status: string;
  profile: {
    bio: string;
    avatar: string;
  };
  ratings: {
    givenRatings: any[];
    receivedRatings: any[];
  };
  subscription: {
    sessionBalance: number;
    specialKeyAccess: boolean;
    purchasedBundles: any[];
  };
  flags: any[];
  uplifter: any[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

const ITEMS_PER_PAGE = 5;

const History: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [selectedSession, setSelectedSession] = useState<SessionHistory | null>(null);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'hero' | 'uplifter'>('all');
  const { userStats, dbId, loadingHistory, currentRole, fetchUserStats } = useSessionStore() as { userStats: Session[], dbId: string, currentRole: string, loadingHistory: boolean, fetchUserStats: () => void };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (!userStats || userStats.length === 0) {
          return;
        }

        // Sort sessions by date (newest first)
        const sortedSessions = [...userStats].sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        setTotalSessions(sortedSessions.length);

        // Filter based on active tab
        let filtered = sortedSessions;
        if (activeTab === 'hero') {
          filtered = sortedSessions.filter(session => session.heroId === dbId);
        } else if (activeTab === 'uplifter') {
          filtered = sortedSessions.filter(session => session.uplifterId === dbId);
        }

        setFilteredSessions(filtered);
      } catch (error) {
        console.error("Error processing session data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userStats, dbId, activeTab]);

  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  const totalPages = Math.ceil(filteredSessions.length / ITEMS_PER_PAGE);

  const displaySessions = filteredSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getSessionStatus = (session: Session) => {
    if (session.status === 'declined') {
      return { text: 'Declined', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' };
    }
    else if (!session.duration || Number.isNaN(Math.floor(session.duration / 60))) {
      return { text: 'Session Missed', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' };
    }


    if (session.status === 'completed') {
      return { text: 'Completed', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' };
    }
    return { text: 'In Progress', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
  };

  // Function to render star ratings
  const renderStarRating = (rating?: number) => {
    if (rating === undefined) return null;

    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
          />
        ))}
      </div>
    );
  };

  // Function to render page numbers with ellipsis for mobile
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = window.innerWidth < 640 ? 3 : 5;

    // Always show first page
    buttons.push(
      <button
        key={1}
        onClick={() => setCurrentPage(1)}
        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm ${currentPage === 1
          ? 'bg-purple-500 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
      >
        1
      </button>
    );

    // Calculate start and end of page range to show
    let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);

    // Adjust if we're showing fewer pages than possible
    if (endPage - startPage < maxVisiblePages - 3) {
      startPage = Math.max(2, Math.min(startPage, totalPages - maxVisiblePages + 2));
      endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);
    }

    // Add ellipsis if there's a gap after first page
    if (startPage > 2) {
      buttons.push(
        <span key="ellipsis-start" className="w-8 h-8 flex items-center justify-center text-gray-500">
          ...
        </span>
      );
    }

    // Add visible pages
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm ${currentPage === i
            ? 'bg-purple-500 text-white'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
          {i}
        </button>
      );
    }

    // Add ellipsis if there's a gap before last page
    if (endPage < totalPages - 1) {
      buttons.push(
        <span key="ellipsis-end" className="w-8 h-8 flex items-center justify-center text-gray-500">
          ...
        </span>
      );
    }

    // Always show last page if there are multiple pages
    if (totalPages > 1) {
      buttons.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm ${currentPage === totalPages
            ? 'bg-purple-500 text-white'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  // Function to render mood change indicator
  const renderMoodChange = (initialMood?: number, finalMood?: number) => {
    if (initialMood === undefined || finalMood === undefined) return null;

    const moodChange = finalMood - initialMood;
    const isPositive = moodChange > 0;
    const isNeutral = moodChange === 0;

    return (
      <div className="flex flex-row items-center space-x-2 whitespace-nowrap">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Mood: {initialMood} →
        </span>
        <div className="flex flex-row items-center space-x-1">
          <span className="text-sm font-medium">{finalMood}</span>
          {!isNeutral && (
            isPositive ? (
              <ArrowUp className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-500" />
            )
          )}
        </div>
      </div>
    );
  };

  if (loading || loadingHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
        <Loader className="w-12 h-12 text-purple-500 animate-spin" />
        <p className="text-gray-600 dark:text-gray-300">Loading your session history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold">Session History</h2>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'all'
              ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('hero')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'hero'
              ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            As Hero
          </button>
          <button
            onClick={() => setActiveTab('uplifter')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'uplifter'
              ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            As Uplifter
          </button>
        </div>
      </div>

      {filteredSessions.length === 0 && loadingHistory == false ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow p-8">
          <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-3">No Sessions Found</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {activeTab === 'all'
              ? "You don't have any sessions yet. Your completed sessions will appear here."
              : `You don't have any sessions as ${activeTab === 'hero' ? 'hero' : 'uplifter'} yet.`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {displaySessions.map((session) => {
              const sessionRole = session.heroId === dbId ? 'hero' : 'uplifter';
              const status = getSessionStatus(session);

              return (
                <div
                  key={session._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                  onClick={() => {
                    // Would handle session selection for modal view
                    // setSelectedSession(session);
                  }}
                >
                  <div className="p-5 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between mb-4">



                      {/* you in historty */}

                      <div className="flex items-center space-x-3">
                        {dbId === session.uplifters?.[0]?._id && (<>{session.heros && session.heros[0] ? (
                          <img
                            src={session.heros[0].profile.avatar || 'https://via.placeholder.com/40'}
                            alt={session.heros[0].userName || 'User'}
                            className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}</>)}
                        {dbId === session.heros?.[0]?._id && (<>{session.uplifters && session.uplifters[0] ? (
                          <img
                            src={session.uplifters[0].profile.avatar || 'https://via.placeholder.com/40'}
                            alt={session.uplifters[0].userName || 'User'}
                            className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}</>)}

                        <div>
                          <h3 className="font-semibold">
                            {dbId === session.uplifters?.[0]?._id && (
                              <>Session with {session?.heros?.[0]?.userName || 'Anonymous'} </>
                            )}
                            {dbId === session.heros?.[0]?._id && (
                              <>Session with {session?.uplifters?.[0]?.userName || 'Anonymous'} </>
                            )}

                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {/* <span>
                              {formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}
                            </span> */}

                            <span>
                              {Date.now() - new Date(session.startTime).getTime() > 24 * 60 * 60 * 1000 ? (
                                `${new Date(session.startTime).toLocaleDateString()} | ${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`
                              ) : (
                                formatDistanceToNow(new Date(session.startTime), { addSuffix: true })
                              )}
                            </span>
                          </div>
                        </div>
                      </div>


                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex items-center space-x-2">
                          {session.inappropriate && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 flex items-center">
                              <Flag className="w-3 h-3 mr-1" />
                              Inappropriate
                            </span>
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.text}
                          </span>
                        </div>

                        {session.ratingGiven !== undefined && (
                          <div className="flex items-center">
                            {renderStarRating(session.ratingGiven)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center text-sm mt-4">
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                        <Clock className="w-4 h-4" />
                        <span>
                          {!session.duration || Number.isNaN(Math.floor(session.duration / 60))
                            ? 'No duration recorded'
                            : `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`}
                        </span>
                      </div>


                      <div className="flex items-center mt-2 sm:mt-0">
                        <span className={`
                          px-3 py-1 rounded-full text-xs font-medium
                          ${sessionRole === 'hero'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}
                        `}>
                          You as {sessionRole === 'hero' ? 'Hero' : 'Uplifter'}
                        </span>
                      </div>
                    </div>


                    {(session.initialMood !== undefined && session.finalMood !== undefined) && (
                      <div className=" border-t border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center text-sm ">
                          <div className="flex items-center m-2 space-x-2">
                            <LineChart className="w-5 h-4 text-purple-500" />
                            {renderMoodChange(session.initialMood, session.finalMood)}
                          </div>
                          <div className="flex flex-wrap justify-between items-center ml-8 space-x-2 text-gray-600 dark:text-gray-300">
                            <p>
                              <b>Hero's Reflection: </b>
                              {session.feedback
                                ? <>{session.feedback}</>
                                : <></>}
                            </p>
                          </div>
                        </div>
                      </div>

                    )}

                  </div>
                </div>

              );
            })}
          </div>

          {/* Improved Pagination for Mobile */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 space-y-4 sm:space-y-0">
              <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredSessions.length)} of {filteredSessions.length}
              </div>

              <div className="flex items-center justify-center space-x-1 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
                  {renderPaginationButtons()}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Session Details Modal would go here */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          {/* Modal content */}
        </div>
      )}
    </div>
  );
};

export default History;