import React, { useEffect, useState } from 'react';
import { Search, X, ChevronDown, ChevronUp, Filter, Moon, Sun, UserPlus, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
interface UserProfile {
    bio: string;
    avatar: string;
    ratings?: number;
}

interface User {
    _id: string;
    userName: string;
    email: string;
    status: string;
    role: string;
    flags: number;
    bio?: string;
    profile: UserProfile;
    file: string;
}

interface UserRecords {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    message: string;
    users: User[];
}

interface FilterOptions {
    status: string;
    role: string;
    hasFlags: boolean;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

const UserTable: React.FC = () => {
    const [userData, setUserData] = useState<UserRecords | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
    const [editUserName, setEditUserName] = useState<string | null>(null);
    const [editUserEmail, setEditUserEmail] = useState<string | null>(null);
    const [editUserBio, setEditUserBio] = useState<string | null>(null);
    const [editUserRole, setEditUserRole] = useState<string | null>(null);
    const [editUserStatus, setEditUserStatus] = useState<string | null>(null);
    const [editUserFlags, setEditUserFlags] = useState<number | null>(null);
    const [editUserImage, setEditUserImage] = useState<string | null>(null);
    const [editUserId, setEditUserId] = useState<string | null>(null);
    const [isUpdatingRecords, setIsUpdatingRecords] = useState<boolean>(false);
    const [filters, setFilters] = useState<FilterOptions>({
        status: 'all',
        role: 'all',
        hasFlags: false,
        search: '',
        sortBy: 'userName',
        sortOrder: 'asc'
    });

    // Available roles in the system
    const availableRoles = ['hero', 'admin', 'uplifter'];

    // Available status options
    const statusOptions = ['active', 'pending', 'block'];

    const loadUsers = async (page = 1) => {
        setLoading(true);
        try {
            // Build query parameters for filtering
            const queryParams = new URLSearchParams();
            queryParams.append('page', page.toString());

            if (filters.status !== 'all') {
                queryParams.append('status', filters.status);
            }

            if (filters.role !== 'all') {
                queryParams.append('role', filters.role);
            }

            if (filters.hasFlags) {
                queryParams.append('hasFlags', 'true');
            }

            if (filters.search) {
                queryParams.append('search', filters.search);
            }

            if (filters.sortBy) {
                queryParams.append('sortBy', filters.sortBy);
                queryParams.append('sortOrder', filters.sortOrder);
            }

            const response = await fetch(`https://www.upliftmee.com/api/admin/deshboardUsers?${queryParams}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const data: UserRecords = await response.json();
            if (!response.ok) throw Error(data.message);
            setUserData(data);
            setCurrentPage(data.currentPage);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
        // Refresh data every 5 minutes instead of 30 seconds for better performance
        const interval = setInterval(() => loadUsers(currentPage), 300000);
        return () => clearInterval(interval);
    }, []);

    // Effect to reload users when filters change
    useEffect(() => {
        loadUsers(1); // Reset to first page when filters change
    }, [filters]);

    const handleEdit = (user: User) => {
        setEditUserBio(user.profile.bio);
        setEditUserEmail(user.email);
        setEditUserFlags(user.flags);
        setEditUserId(user._id)


        setEditUserName(user.userName);
        // console.log(user.userName);

        setEditUserRole(user.role);
        setEditUserStatus(user.status);

        setPreviewImage(user.profile?.avatar || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditFormData({});
        setPreviewImage(null);
    };

    const handleDelete = async (userId: string) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                const response = await fetch(`https://www.upliftmee.com/api/admin/delete`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIdToDelete: userId }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Failed to delete user");
                }

                // console.log("User deleted:", userId);

                // Refresh users list after deletion
                await loadUsers(currentPage);
            } catch (error) {
                console.error("Error deleting user:", error);
            }
        }
    };

    const handleGiftSession = async (userId: string) => {
  const confirmed = window.confirm("Are you sure you want to gift 3 sessions?");
  if (!confirmed) return;

  try {
    const response = await fetch("https://www.upliftmee.com/api/admin/gift3sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userIdToGift: userId }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to gift sessions");

    console.log("✅ Gifted 3 sessions to user:", userId);
  } catch (error) {
    console.error("❌ Error gifting sessions:", error);
  }
};


    const handleSave = async () => {

        try {
            const updatedUser = {
                userId: editUserId,           // Required for backend to find user
                userName: editUserName,        // userName from your Schema
                email: editUserEmail,          // email from your Schema
                role: editUserRole,            // role from your Schema
                status: editUserStatus,        // status from your Schema
                flags: Number(editUserFlags),  // flags must be Number
                bio: editUserBio,              // bio under profile
            };

            const response = await fetch("https://www.upliftmee.com/api/admin/updateUser", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",  // telling server it's JSON
                },
                body: JSON.stringify(updatedUser),
                credentials: "include", // Important to send cookies
            });

            if (!response.ok) {


                throw new Error("Failed to update user");
            }


            setIsModalOpen(false);
            await loadUsers(currentPage); // Refresh users after update
            handleCloseModal();

        } catch (error) {

            console.error("Error updating user:", error);
        }
    };


    const handleFormChange = (field: string, value: any) => {


        setEditFormData((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                [field]: value, // Directly set fields in main object
            };
        });
    };


    // Handle image change (avatar file)
    // const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const file = e.target.files?.[0];

    //     if (!file) return;

    //     try {
    //         setIsUpdatingRecords(true)
    //         // Preview immediately
    //         setPreviewImage(URL.createObjectURL(file));
    //         // console.log(editUserId);

    //         // Prepare FormData
    //         const formData = new FormData();
    //         formData.append("file", file); // multer is waiting for "file"
    //         formData.append("userId", editUserId || 'noId')



    //         // Upload to server
    //         const response = await fetch("https://www.upliftmee.com/api/admin/updateImage", {
    //             method: "POST",
    //             body: formData,
    //             credentials: "include", // if you are using cookies/sessions
    //         });

    //         if (!response.ok) {
    //         setIsUpdatingRecords(false)

    //             throw new Error("Failed to upload image");
    //         }
    //         setIsUpdatingRecords(false)

    //         const data = await response.json();
    //          setEditUserImage(data.filePath);

    //     } catch (error) {
    //         setIsUpdatingRecords(false)

    //         console.error("Error uploading image:", error);
    //     }
    // };

    function base64ToFile(base64String: string, filename: string): File {
        const arr = base64String.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || '';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new File([u8arr], filename, { type: mime });
    }


    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) {
            console.warn('No file selected.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            console.warn('Selected file is not an image.');
            return;
        }

        try {
            setIsUpdatingRecords(true);

            // Convert file to base64 string using FileReader
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result;

                // Convert base64 back to a File
                const convertedFile = base64ToFile(base64String as string, file.name || 'image.jpg');

                // Compress the file
                const compressedFile = await imageCompression(convertedFile, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1024,
                    useWebWorker: true,
                });

                // Preview the compressed image
                setPreviewImage(URL.createObjectURL(compressedFile));

                // Prepare FormData
                const formData = new FormData();
                formData.append("file", compressedFile); // multer expects "file"
                formData.append("userId", editUserId || 'noId');

                // Upload to server
                const response = await fetch("https://www.upliftmee.com/api/admin/updateImage", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("Failed to upload image");
                }

                const data = await response.json();
                setEditUserImage(data.filePath);
            };

            reader.readAsDataURL(file);
            setIsUpdatingRecords(false);
        } catch (error) {
            console.error("Error uploading image:", error);
        }
    };


    const handleFilterChange = (field: keyof FilterOptions, value: any) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        loadUsers(page);
    };

    const handleSort = (field: string) => {
        setFilters(prev => ({
            ...prev,
            sortBy: field,
            sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        loadUsers(1);
    };

    // Calculate pagination values
    const users = userData?.users || [];
    const totalPages = userData?.totalPages || 1;
    const totalUsers = userData?.totalUsers || 0;
    const start = userData ? (userData.currentPage - 1) * 10 + 1 : 0;
    const end = userData ? Math.min(userData.currentPage * 10, totalUsers) : 0;

    return (
        <div className="w-full transition-colors bg-gray-100 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {/* Search and Filter Panel */}
                <div className="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        {/* Search Form */}
                        <form onSubmit={handleSearch} className="flex-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={16} className="text-gray-500 dark:text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    placeholder="Search users by name or email..."
                                    className="w-full pl-10 pr-4 py-2 rounded-md border shadow-sm bg-white border-gray-300 focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 text-gray-700"
                                />
                            </div>
                        </form>

                        {/* Filter Toggle Button */}
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="inline-flex items-center px-4 py-2 rounded-md bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600"
                        >
                            <Filter size={16} className="mr-2" />
                            {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
                            {isFilterOpen ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />}
                        </button>
                    </div>

                    {/* Expanded Filters */}
                    {isFilterOpen && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Status Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
                                    Status
                                </label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                    className="w-full px-3 py-2 rounded-md shadow-sm bg-white border-gray-300 focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 border text-gray-700"
                                >
                                    <option value="all">All Statuses</option>
                                    {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Role Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
                                    Role
                                </label>
                                <select
                                    value={filters.role}
                                    onChange={(e) => handleFilterChange('role', e.target.value)}
                                    className="w-full px-3 py-2 rounded-md shadow-sm bg-white border-gray-300 focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 border text-gray-700"
                                >
                                    <option value="all">All Roles</option>
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Flags Filter */}
                            <div className="flex items-center">
                                <label className="inline-flex items-center cursor-pointer text-gray-700 dark:text-gray-200">
                                    <input
                                        type="checkbox"
                                        checked={filters.hasFlags}
                                        onChange={(e) => handleFilterChange('hasFlags', e.target.checked)}
                                        className="h-4 w-4 rounded bg-white border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <span className="ml-2 text-sm">Show only flagged users</span>
                                </label>
                            </div>

                            <div className="md:col-span-3 flex justify-end mt-2">
                                <button
                                    onClick={() => {
                                        setFilters({
                                            status: 'all',
                                            role: 'all',
                                            hasFlags: false,
                                            search: '',
                                            sortBy: 'userName',
                                            sortOrder: 'asc',
                                        });
                                    }}
                                    className="px-4 py-2 text-sm rounded-md bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center p-12 text-gray-800 dark:text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Responsive Table */}
                        <div className="overflow-x-auto shadow rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th
                                            className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer text-gray-500 dark:text-gray-300"
                                            onClick={() => handleSort('userName')}
                                        >
                                            <div className="flex items-center">
                                                Username
                                                {filters.sortBy === 'userName' && (
                                                    filters.sortOrder === 'asc' ? (
                                                        <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ChevronDown size={14} className="ml-1" />
                                                    )
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hidden md:table-cell text-gray-500 dark:text-gray-300"
                                            onClick={() => handleSort('email')}
                                        >
                                            <div className="flex items-center">
                                                Email
                                                {filters.sortBy === 'email' && (
                                                    filters.sortOrder === 'asc' ? (
                                                        <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ChevronDown size={14} className="ml-1" />
                                                    )
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer text-gray-500 dark:text-gray-300"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center">
                                                Status
                                                {filters.sortBy === 'status' && (
                                                    filters.sortOrder === 'asc' ? (
                                                        <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ChevronDown size={14} className="ml-1" />
                                                    )
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer text-gray-500 dark:text-gray-300"
                                            onClick={() => handleSort('role')}
                                        >
                                            <div className="flex items-center">
                                                Role
                                                {filters.sortBy === 'role' && (
                                                    filters.sortOrder === 'asc' ? (
                                                        <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ChevronDown size={14} className="ml-1" />
                                                    )
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer text-gray-500 dark:text-gray-300"
                                            onClick={() => handleSort('flags')}
                                        >
                                            <div className="flex items-center">
                                                Flags
                                                {filters.sortBy === 'flags' && (
                                                    filters.sortOrder === 'asc' ? (
                                                        <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ChevronDown size={14} className="ml-1" />
                                                    )
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell text-gray-500 dark:text-gray-300">Bio</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Avatar</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700 dark:bg-gray-900">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                No users found with the selected filters
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((user) => (
                                            <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.userName || 'Unknown'}</div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap hidden md:table-cell">
                                                    <div className="text-sm text-gray-500 dark:text-gray-300">{user.email || 'N/A'}</div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : user.status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : user.role === 'hero'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : user.role === 'uplifter'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {user.role || 'user'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    {user.flags && user.flags > 0 ? (
                                                        <div className="flex items-center">
                                                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold">
                                                                {user.flags}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">0</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-normal align-top">
                                                    <div className="text-sm break-words max-w-xs text-gray-600 dark:text-gray-300">
                                                        {user.profile?.bio || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    {user.profile?.avatar ? (
                                                        <img
                                                            src={user.profile.avatar}
                                                            alt={`${user.userName}'s avatar`}
                                                            className="w-10 h-10 rounded-full object-cover border shadow"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                                                            <span className="text-gray-500 dark:text-gray-300">
                                                                {user.userName?.[0]?.toUpperCase() || '?'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(user)}
                                                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(user._id)}
                                                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                                                        >
                                                            Delete
                                                        </button>
                                                         <button
                                                            onClick={() => handleGiftSession(user._id)}
                                                            className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white"
                                                        >
                                                            Gift 3 Sessions
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col md:flex-row items-center justify-between mt-6 px-2">
                            <div className="text-sm mb-4 md:mb-0 text-gray-700 dark:text-gray-300">
                                Showing <span className="font-medium">{start}</span> to <span className="font-medium">{end}</span> of{" "}
                                <span className="font-medium">{totalUsers}</span> users
                            </div>

                            <div className="inline-flex space-x-1">
                                {/* Previous Button */}
                                <button
                                    className="px-2 py-1 md:px-4 md:py-2 text-sm font-medium rounded disabled:opacity-50 
                                bg-white border border-gray-300 text-gray-700 hover:bg-gray-100
                                dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                                    disabled={currentPage === 1}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                >
                                    Previous
                                </button>

                                {/* Page Numbers (Desktop) */}
                                <div className="hidden md:flex space-x-1">
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        if (
                                            i === 0 ||
                                            i === totalPages - 1 ||
                                            (i >= currentPage - 2 && i <= currentPage + 2)
                                        ) {
                                            return (
                                                <button
                                                    key={i + 1}
                                                    className={`px-4 py-2 text-sm font-medium rounded border ${currentPage === i + 1
                                                        ? "bg-blue-600 border-blue-600 text-white"
                                                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                                                        }`}
                                                    onClick={() => handlePageChange(i + 1)}
                                                >
                                                    {i + 1}
                                                </button>
                                            );
                                        }

                                        // Show dots for gaps
                                        if (i === currentPage - 3 || i === currentPage + 3) {
                                            return (
                                                <span
                                                    key={`dots-${i}`}
                                                    className="px-2 py-2 text-gray-500 dark:text-gray-300"
                                                >
                                                    ...
                                                </span>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>

                                {/* Mobile View Page Info */}
                                <div className="md:hidden text-sm px-2 py-2 text-gray-700 dark:text-gray-300">
                                    Page {currentPage} of {totalPages}
                                </div>

                                {/* Next Button */}
                                <button
                                    className="px-2 py-1 md:px-4 md:py-2 text-sm font-medium rounded disabled:opacity-50 
                                bg-white border border-gray-300 text-gray-700 hover:bg-gray-100
                                dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                                    disabled={currentPage === totalPages}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Add New User Button - Fixed Position */}
                {/* <div className="fixed bottom-8 right-8">
                <button
                    onClick={() => {
                        setEditFormData({
                            status: 'active',
                            role: 'user',
                            flags: 0,
                            profile: { bio: '', avatar: '' }
                        });
                        setPreviewImage(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center justify-center h-14 w-14 rounded-full shadow-lg 
                    bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <UserPlus size={24} />
                </button>
            </div> */}

                {/* Edit/Add User Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                        <div className="rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                        {editUserName ? 'Edit User' : 'Add New User'}
                                    </h3>
                                    <button
                                        onClick={handleCloseModal}
                                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-200"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* User Avatar */}
                                    <div className="flex flex-col items-center space-y-3">
                                        {isUpdatingRecords ? (
                                            <div className="flex flex-col items-center space-y-2 py-8">
                                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                <p className="text-gray-600 dark:text-gray-300 text-sm">Uploading image, please wait...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {previewImage ? (
                                                    <img
                                                        src={previewImage}
                                                        alt="User avatar preview"
                                                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                                                    />
                                                ) : (
                                                    <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                                                        <span className="text-2xl text-gray-500 dark:text-gray-300">
                                                            {editFormData.userName?.[0]?.toUpperCase() || '?'}
                                                        </span>
                                                    </div>
                                                )}

                                                <label className="cursor-pointer inline-flex items-center px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white">
                                                    Change Avatar
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleImageChange}
                                                    />
                                                </label>
                                            </>
                                        )}
                                    </div>


                                    {/* Username */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Username</label>
                                        <input
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                            value={editUserName || ''}
                                            onChange={(e) => setEditUserName(e.target.value)}
                                            placeholder="Enter username"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Email</label>
                                        <input
                                            type="email"
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                            value={editUserEmail || ''}
                                            onChange={(e) => setEditUserEmail(e.target.value)}
                                            placeholder="Enter email"
                                        />
                                    </div>

                                    {/* Role selection */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Role</label>
                                        <select
                                            value={editUserRole || 'user'}
                                            onChange={(e) => setEditUserRole(e.target.value)}
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                        >
                                            {availableRoles.map(role => (
                                                <option key={role} value={role}>
                                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Status</label>
                                        <select
                                            value={editUserStatus || 'active'}
                                            onChange={(e) => setEditUserStatus(e.target.value)}
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                        >
                                            {statusOptions.map(status => (
                                                <option key={status} value={status}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Flags */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                                Flags
                                            </label>
                                            {editFormData.flags && Number(editFormData.flags) > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Flagged User
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                            value={editUserFlags || 0}
                                            onChange={(e) => setEditUserFlags(parseInt(e.target.value))}
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Number of flags this user has received
                                        </p>
                                    </div>

                                    {/* Bio */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Bio</label>
                                        <textarea
                                            className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 shadow-sm focus:ring-blue-600 focus:border-blue-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                            value={editUserBio || ''}
                                            onChange={(e) => setEditUserBio(e.target.value)}
                                            rows={3}
                                            placeholder="Enter user bio"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-6 flex justify-end space-x-3">
                                    <button
                                        onClick={handleCloseModal}
                                        className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        {editUserName ? 'Save Changes' : 'Add User'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                )}
            </div>
        </div>
    );
};

export default UserTable;