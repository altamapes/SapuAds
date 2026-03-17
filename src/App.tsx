/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { 
  Menu, 
  Search, 
  Mic, 
  Video as VideoIcon, 
  Bell, 
  User, 
  Home, 
  Compass, 
  PlaySquare, 
  History, 
  ThumbsUp, 
  ThumbsDown,
  Share2, 
  MoreHorizontal,
  MoreVertical,
  ShieldCheck,
  ShieldAlert,
  X,
  Loader2,
  Repeat,
  List,
  Trash2,
  Plus,
  LogOut,
  LogIn,
  Settings,
  LayoutDashboard,
  Users,
  BarChart3,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getYouTubeVideos, getChannelVideos, getVideoDetails, Video, Channel } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  FirebaseUser 
} from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6 text-center">
          <ShieldAlert size={64} className="text-red-500 mb-6" />
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 max-w-lg mb-6 overflow-auto max-h-48">
            <code className="text-xs text-red-400">{this.state.errorInfo}</code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-white/90 transition-all"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SapuAdsApp />
    </ErrorBoundary>
  );
}

function SapuAdsApp() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [recommendations, setRecommendations] = useState<Video[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isAdBlockActive, setIsAdBlockActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAdBlockNotification, setShowAdBlockNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [playlist, setPlaylist] = useState<Video[]>([]);
  
  // Firebase State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userPlaylist, setUserPlaylist] = useState<Video[]>([]);
  
  const [isLooping, setIsLooping] = useState(true);
  const [useNoCookie, setUseNoCookie] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'trending' | 'playlist' | 'dashboard' | 'admin'>('home');
  const [channelCache, setChannelCache] = useState<Record<string, Video[]>>({});

  // Admin Stats
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalPlaylistItems: 0,
    recentUsers: [] as any[]
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          } else {
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: firebaseUser.email === 'altamapes@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
        setUserPlaylist([]); // Clear playlist on logout
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Playlist Sync Listener
  useEffect(() => {
    if (!user) return;

    const playlistRef = collection(db, 'users', user.uid, 'playlist');
    const q = query(playlistRef, orderBy('addedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as unknown as Video));
      setUserPlaylist(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/playlist`);
    });

    return () => unsubscribe();
  }, [user]);

  // Admin Stats Listener
  useEffect(() => {
    if (userProfile?.role !== 'admin' || activeTab !== 'admin') return;

    const fetchAdminStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const recentUsers = usersSnap.docs
          .map(d => d.data())
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 5);

        setAdminStats({
          totalUsers: usersSnap.size,
          totalPlaylistItems: 0, // Would need a collectionGroup query or similar
          recentUsers
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      }
    };

    fetchAdminStats();
  }, [userProfile, activeTab]);

  useEffect(() => {
    // Enrich placeholder videos in user playlist
    const placeholders = userPlaylist.filter(v => v.title === "Video dari Link");
    if (placeholders.length > 0) {
      const timer = setTimeout(() => {
        placeholders.forEach(placeholder => {
          getVideoDetails(placeholder.id, YOUTUBE_API_KEY).then(enriched => {
            if (enriched) {
              setUserPlaylist(prev => prev.map(v => v.id === placeholder.id ? enriched : v));
              setSelectedVideo(prev => prev?.id === placeholder.id ? enriched : prev);
            }
          }).catch(() => {});
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userPlaylist.length]); // Re-run when items are added

  const recommendationsRef = useRef<Video[]>([]);
  const videosRef = useRef<Video[]>([]);
  const selectedVideoRef = useRef<Video | null>(null);
  const playlistRef = useRef<Video[]>([]);
  const userPlaylistRef = useRef<Video[]>([]);
  const isLoopingRef = useRef<boolean>(true);

  useEffect(() => {
    recommendationsRef.current = recommendations;
  }, [recommendations]);

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    userPlaylistRef.current = userPlaylist;
  }, [userPlaylist]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  const fetchVideos = async (query: string = 'trending') => {
    if (!YOUTUBE_API_KEY) {
      console.warn("YouTube API Key is missing. Please add it to your secrets.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setApiError(null);
    const { videos: results, channel, error } = await getYouTubeVideos(query, YOUTUBE_API_KEY);
    
    if (error) {
      setApiError(error);
    } else {
      setVideos(results);
      setPlaylist(results);
      // Only show channel profile if it's a specific search, not the default trending home page
      setCurrentChannel(query === 'trending' ? null : (channel || null));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVideos();
    
    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
      setIsApiReady(true);
    };

    // Check if already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      setIsApiReady(true);
    }
  }, []);

  useEffect(() => {
    if (selectedVideo && isApiReady) {
      if (player && typeof player.loadVideoById === 'function') {
        try {
          player.loadVideoById(selectedVideo.id);
        } catch (e) {
          console.error("Error loading video:", e);
          createPlayer();
        }
      } else {
        createPlayer();
      }
    }
  }, [selectedVideo, isApiReady]);

  const createPlayer = () => {
    if (!selectedVideo) return;
    
    // Clean up existing player if any
    const playerContainer = document.getElementById('youtube-player');
    if (playerContainer) {
      playerContainer.innerHTML = '';
    }

    const newPlayer = new (window as any).YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: selectedVideo.id,
      host: useNoCookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com',
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onStateChange: (event: any) => {
          // YT.PlayerState.ENDED is 0
          if (event.data === 0) {
            playNextVideo();
          }
        },
        onError: (e: any) => {
          console.error("YouTube Player Error:", e);
        }
      }
    });
    setPlayer(newPlayer);
  };

  const playNextVideo = () => {
    console.log("Autoplay: Attempting to play next video");
    
    // Prioritize user playlist if it has videos and the current video is in it
    const isInUserPlaylist = userPlaylistRef.current.some(v => v.id === selectedVideoRef.current?.id);
    const currentList = isInUserPlaylist 
      ? userPlaylistRef.current 
      : (playlistRef.current.length > 0 ? playlistRef.current : videosRef.current);
    
    const currentIndex = currentList.findIndex(v => v.id === selectedVideoRef.current?.id);
    
    if (currentIndex !== -1 && currentIndex < currentList.length - 1) {
      const nextVideo = currentList[currentIndex + 1];
      console.log("Autoplay: Playing next in sequence", nextVideo.title);
      handleVideoSelect(nextVideo);
    } else if (currentList.length > 0 && isLoopingRef.current) {
      // Loop back to start if looping is enabled
      const nextVideo = currentList[0];
      console.log("Autoplay: Reached end, looping to start", nextVideo.title);
      handleVideoSelect(nextVideo);
    } else {
      console.log("Autoplay: End of list or looping disabled");
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const addToPlaylist = async (video: Video) => {
    if (!user) {
      login();
      return;
    }

    if (!userPlaylist.some(v => v.id === video.id)) {
      const playlistItemRef = doc(db, 'users', user.uid, 'playlist', video.id);
      try {
        await setDoc(playlistItemRef, {
          videoId: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          channelName: video.channelName,
          channelAvatar: video.channelAvatar,
          duration: video.duration,
          views: video.views,
          postedAt: video.postedAt,
          addedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/playlist/${video.id}`);
      }
    }
  };

  const removeFromPlaylist = async (videoId: string) => {
    if (!user) return;
    const playlistItemRef = doc(db, 'users', user.uid, 'playlist', videoId);
    try {
      await deleteDoc(playlistItemRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/playlist/${videoId}`);
    }
  };

  const toggleLoop = () => {
    setIsLooping(prev => !prev);
  };

  useEffect(() => {
    if (isAdBlockActive) {
      setShowAdBlockNotification(true);
      const timer = setTimeout(() => setShowAdBlockNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAdBlockActive]);

  const extractVideoId = (url: string) => {
    if (!url) return null;
    
    // Handle YouTube Shorts
    if (url.includes('/shorts/')) {
      const parts = url.split('/shorts/');
      const id = parts[1]?.split(/[?#]/)[0];
      if (id && id.length === 11) return id;
    }
    
    // Handle standard and mobile URLs
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
      return match[2];
    }

    // Fallback for other formats
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      }
      if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1);
      }
    } catch (e) {
      // Not a valid URL, maybe just an ID
      if (url.length === 11) return url;
    }
    
    return null;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const videoId = extractVideoId(searchQuery);
    if (videoId) {
      // Clear errors and stop loading immediately for direct links
      setApiError(null);
      setIsLoading(false);
      
      const placeholderVideo: Video = {
        id: videoId,
        title: "Loading video details...",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        channelName: "Loading channel...",
        channelId: "",
        channelAvatar: "https://www.youtube.com/s/desktop/ce11e301/img/favicon_144x144.png",
        views: "Fetching views...",
        postedAt: "Fetching date...",
        duration: "--:--",
        description: "Memutar langsung dari link. Sedang mengambil informasi video..."
      };
      
      setSelectedVideo(placeholderVideo);
      setRecommendations([]);
      setPlaylist([placeholderVideo]);
      
      // Try to enrich data in background
      getVideoDetails(videoId, YOUTUBE_API_KEY).then((enriched) => {
        if (enriched) {
          setSelectedVideo(prev => prev?.id === videoId ? enriched : prev);
          setPlaylist(prev => prev.map(v => v.id === videoId ? enriched : v));
          setUserPlaylist(prev => prev.map(v => v.id === videoId ? enriched : v));
        }
      }).catch(() => {
        // Fallback to basic placeholder if everything fails
        const finalPlaceholder = { ...placeholderVideo, title: "Video dari Link", views: "Direct Play", postedAt: "Sekarang" };
        setSelectedVideo(prev => prev?.id === videoId ? finalPlaceholder : prev);
        setPlaylist(prev => prev.map(v => v.id === videoId ? finalPlaceholder : v));
      });
    } else {
      setSelectedVideo(null);
      setCurrentChannel(null);
      fetchVideos(searchQuery);
    }
  };

  const handleVideoSelect = async (video: Video) => {
    setSelectedVideo(video);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Check cache first
    if (channelCache[video.channelId]) {
      const cachedVideos = channelCache[video.channelId];
      setRecommendations(cachedVideos.filter(v => v.id !== video.id));
      setPlaylist(cachedVideos);
      return;
    }

    // Fetch videos from the same channel for recommendations
    const { videos: channelResults } = await getChannelVideos(video.channelId, YOUTUBE_API_KEY);
    if (channelResults.length > 0) {
      setRecommendations(channelResults.filter(v => v.id !== video.id));
      setPlaylist(channelResults); // Update playlist to the channel's videos
      
      // Update cache
      setChannelCache(prev => ({
        ...prev,
        [video.channelId]: channelResults
      }));
    } else {
      // Fallback to current search results if channel fetch fails
      setRecommendations(videos.filter(v => v.id !== video.id));
    }
  };

  const handleChannelClick = (e: React.MouseEvent, channelName: string) => {
    e.stopPropagation();
    setSearchQuery(channelName);
    setSelectedVideo(null);
    fetchVideos(channelName);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-2 sm:px-4 py-2 sticky top-0 bg-[#0f0f0f] z-50 border-b border-white/5">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block"
          >
            <Menu size={24} />
          </button>
          <div 
            className="flex items-center gap-1 cursor-pointer" 
            onClick={() => {
              setSelectedVideo(null);
              setCurrentChannel(null);
              fetchVideos();
            }}
          >
            <div className="bg-red-600 p-1 rounded-lg">
              <PlaySquare className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" fill="white" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tighter">SapuAds</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex items-center flex-1 max-w-2xl px-2 sm:px-4">
          <div className="flex items-center flex-1 bg-[#121212] border border-white/10 rounded-full overflow-hidden focus-within:border-blue-500">
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full bg-transparent px-3 sm:px-4 py-1.5 sm:py-2 outline-none text-sm sm:text-base text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="bg-white/10 px-3 sm:px-5 py-1.5 sm:py-2 border-l border-white/10 hover:bg-white/20 transition-colors">
              <Search className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
            </button>
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-3">
          <button 
            onClick={() => setIsAdBlockActive(!isAdBlockActive)}
            className={`flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-full transition-all ${
              isAdBlockActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
            title={isAdBlockActive ? 'Ad-Blocker Active' : 'Ad-Blocker Disabled'}
          >
            {isAdBlockActive ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            <span className="text-xs font-medium hidden lg:inline">
              {isAdBlockActive ? 'Ad-Block' : 'Ads On'}
            </span>
          </button>
          
          {user ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="User Dashboard"
              >
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || 'User'} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/20"
                />
              </button>
              {userProfile?.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-orange-400"
                  title="Admin Panel"
                >
                  <ShieldCheck size={20} />
                </button>
              )}
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-white text-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm hover:bg-white/90 transition-all"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} hidden md:flex flex-col gap-2 p-2 overflow-y-auto transition-all duration-300 border-r border-white/5`}>
          <SidebarItem 
            icon={<Home size={22} />} 
            label="Home" 
            active={activeTab === 'home' && !selectedVideo && !currentChannel} 
            onClick={() => {
              setActiveTab('home');
              setSelectedVideo(null);
              setCurrentChannel(null);
              fetchVideos();
            }} 
            isOpen={isSidebarOpen} 
          />
          <SidebarItem 
            icon={<Compass size={22} />} 
            label="Trending" 
            active={activeTab === 'trending'}
            onClick={() => {
              setActiveTab('trending');
              setSelectedVideo(null);
              setCurrentChannel(null);
              fetchVideos('trending');
            }}
            isOpen={isSidebarOpen} 
          />
          <SidebarItem 
            icon={<List size={22} />} 
            label="Playlist" 
            active={activeTab === 'playlist'}
            onClick={() => {
              setActiveTab('playlist');
              setSelectedVideo(null);
              setCurrentChannel(null);
            }}
            isOpen={isSidebarOpen} 
          />
          {user && (
            <>
              <SidebarItem 
                icon={<LayoutDashboard size={22} />} 
                label="Dashboard" 
                active={activeTab === 'dashboard'}
                onClick={() => {
                  setActiveTab('dashboard');
                  setSelectedVideo(null);
                  setCurrentChannel(null);
                }}
                isOpen={isSidebarOpen} 
              />
              {userProfile?.role === 'admin' && (
                <SidebarItem 
                  icon={<ShieldCheck size={22} className="text-orange-400" />} 
                  label="Admin Panel" 
                  active={activeTab === 'admin'}
                  onClick={() => {
                    setActiveTab('admin');
                    setSelectedVideo(null);
                    setCurrentChannel(null);
                  }}
                  isOpen={isSidebarOpen} 
                />
              )}
            </>
          )}
          <hr className="border-white/10 my-2" />
          {isSidebarOpen && (
            <div className="mt-auto p-4 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                SapuAds Premium
              </h3>
              <p className="text-xs text-white/60">No ads, no interruptions. Just pure content.</p>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#0f0f0f] p-2 sm:p-4 pb-20 md:pb-4">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 size={48} className="animate-spin text-red-600" />
              <p className="text-white/60 font-medium">Fetching YouTube videos...</p>
            </div>
          ) : selectedVideo ? (
            <div className="max-w-[1600px] mx-auto">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Player Column */}
                <div className="flex-1">
                  <div className="aspect-video w-full bg-black rounded-xl overflow-hidden shadow-2xl relative group">
                    <div id="youtube-player" className="w-full h-full" />
                  </div>
                  
                  <div className="mt-4">
                    <h1 className="text-lg sm:text-xl font-bold mb-2" dangerouslySetInnerHTML={{ __html: selectedVideo.title }} />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={selectedVideo.channelAvatar} 
                            alt={selectedVideo.channelName} 
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                            referrerPolicy="no-referrer"
                            onClick={(e) => handleChannelClick(e, selectedVideo.channelName)}
                          />
                          <div 
                            className="cursor-pointer group/channel"
                            onClick={(e) => handleChannelClick(e, selectedVideo.channelName)}
                          >
                            <p className="font-bold text-sm sm:text-base group-hover/channel:text-blue-400 transition-colors">{selectedVideo.channelName}</p>
                            <p className="text-[10px] sm:text-xs text-white/60">YouTube Creator</p>
                          </div>
                        </div>
                        <button className="bg-white text-black px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm hover:bg-white/90 transition-colors">
                          Subscribe
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                        <button 
                          onClick={toggleLoop}
                          className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors whitespace-nowrap ${isLooping ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                          title={isLooping ? "Looping Enabled" : "Looping Disabled"}
                        >
                          <Repeat size={16} className={isLooping ? 'animate-spin-slow' : ''} />
                          <span className="text-xs sm:text-sm font-medium">Loop</span>
                        </button>
                        <button 
                          onClick={playNextVideo}
                          className="flex items-center gap-2 bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-white/20 transition-colors whitespace-nowrap"
                          title="Play Next Video"
                        >
                          <PlaySquare size={16} className="text-blue-400" />
                          <span className="text-xs sm:text-sm font-medium">Next</span>
                        </button>
                        <button 
                          onClick={() => addToPlaylist(selectedVideo)}
                          className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all whitespace-nowrap ${
                            userPlaylist.some(v => v.id === selectedVideo.id)
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                          title={userPlaylist.some(v => v.id === selectedVideo.id) ? "Saved to Playlist" : "Save to Playlist"}
                        >
                          {userPlaylist.some(v => v.id === selectedVideo.id) ? <ShieldCheck size={16} /> : <Plus size={16} />}
                          <span className="text-xs sm:text-sm font-medium">
                            {userPlaylist.some(v => v.id === selectedVideo.id) ? 'Saved' : 'Save'}
                          </span>
                        </button>
                        <button 
                          onClick={() => {
                            setUseNoCookie(!useNoCookie);
                            setTimeout(createPlayer, 100);
                          }}
                          className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors whitespace-nowrap ${!useNoCookie ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                          title="Click if video is blank/black"
                        >
                          <ShieldAlert size={16} />
                          <span className="text-xs sm:text-sm font-medium">Fix Blank</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-white/5 p-4 rounded-xl">
                    <div className="flex gap-2 text-sm font-bold mb-1">
                      <span>{selectedVideo.views}</span>
                      <span>•</span>
                      <span>Published on {selectedVideo.postedAt}</span>
                    </div>
                    <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                      {selectedVideo.description}
                    </p>
                  </div>
                </div>

                {/* Recommendations Column */}
                <div className="w-full lg:w-[400px] flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold">
                      {userPlaylist.length > 0 ? 'My Playlist' : 'Up Next'}
                    </h3>
                    {userPlaylist.length > 0 && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                        {userPlaylist.length} VIDEOS
                      </span>
                    )}
                  </div>

                  {/* Show User Playlist first if it has items */}
                  {userPlaylist.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {userPlaylist.map((video) => (
                        <div 
                          key={`playlist-sidebar-${video.id}`} 
                          className={`flex gap-2 cursor-pointer group p-2 rounded-lg transition-all border ${selectedVideo.id === video.id ? 'bg-blue-500/10 border-blue-500/30' : 'hover:bg-white/5 border-transparent'}`}
                          onClick={() => handleVideoSelect(video)}
                        >
                          <div className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-white/5">
                            <img 
                              src={video.thumbnail} 
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded">
                              {video.duration}
                            </div>
                            {selectedVideo.id === video.id && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="bg-blue-500 p-1 rounded-full shadow-lg">
                                  <PlaySquare size={16} className="text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 overflow-hidden flex-1">
                            <h4 className={`text-xs font-bold line-clamp-2 leading-snug transition-colors ${selectedVideo.id === video.id ? 'text-blue-400' : 'group-hover:text-blue-400'}`} dangerouslySetInnerHTML={{ __html: video.title }} />
                            <p className="text-[10px] text-white/60 truncate">{video.channelName}</p>
                            <div className="flex items-center justify-between mt-auto">
                              <span className="text-[9px] text-white/40">{video.views}</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromPlaylist(video.id);
                                }}
                                className="p-1 text-white/20 hover:text-red-500 transition-colors"
                                title="Remove from playlist"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Recommendations section */}
                  {recommendations.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-px bg-white/10 flex-1" />
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Recommendations</span>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>
                      {recommendations.map((video) => (
                        <div 
                          key={`rec-${video.id}`} 
                          className="flex gap-2 cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors"
                          onClick={() => handleVideoSelect(video)}
                        >
                          <div className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-white/5">
                            <img 
                              src={video.thumbnail} 
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded">
                              {video.duration}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 overflow-hidden flex-1">
                            <h4 className="text-xs font-bold line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors" dangerouslySetInnerHTML={{ __html: video.title }} />
                            <p className="text-[10px] text-white/60 truncate">{video.channelName}</p>
                            <div className="flex gap-1 text-[9px] text-white/40">
                              <span>{video.views}</span>
                              <span>•</span>
                              <span>{video.postedAt}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {userPlaylist.length === 0 && recommendations.length === 0 && (
                    <div className="p-8 bg-white/5 rounded-xl border border-white/10 text-center">
                      <PlaySquare className="mx-auto mb-3 text-white/10" size={32} />
                      <p className="text-sm font-bold text-white/60">No videos available</p>
                      <p className="text-xs text-white/40 mt-1">Add videos to your playlist to see them here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'dashboard' ? (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white/5 rounded-3xl p-6 sm:p-10 border border-white/10 mb-8">
                <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
                  <img 
                    src={user?.photoURL || ''} 
                    alt={user?.displayName || ''} 
                    className="w-24 h-24 rounded-full border-4 border-blue-500/30 shadow-2xl"
                  />
                  <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-bold mb-1">{user?.displayName}</h1>
                    <p className="text-white/60 mb-4">{user?.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                      <span className="bg-blue-500/20 text-blue-400 px-4 py-1 rounded-full text-sm font-bold border border-blue-500/30 uppercase tracking-wider">
                        {userProfile?.role || 'User'}
                      </span>
                      <span className="bg-white/5 text-white/60 px-4 py-1 rounded-full text-sm font-bold border border-white/10">
                        {userPlaylist.length} Saved Videos
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={logout}
                    className="sm:ml-auto flex items-center gap-2 bg-red-500/10 text-red-400 px-6 py-2.5 rounded-full font-bold hover:bg-red-500/20 transition-all border border-red-500/20"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center">
                    <Clock size={24} className="mx-auto mb-3 text-blue-400" />
                    <p className="text-2xl font-bold">{userPlaylist.length}</p>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest mt-1">Playlist Items</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center">
                    <ShieldCheck size={24} className="mx-auto mb-3 text-emerald-400" />
                    <p className="text-2xl font-bold">Active</p>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest mt-1">Account Status</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center">
                    <Repeat size={24} className="mx-auto mb-3 text-orange-400" />
                    <p className="text-2xl font-bold">{isLooping ? 'ON' : 'OFF'}</p>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest mt-1">Auto-Loop</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Account Settings</h2>
                <Settings size={20} className="text-white/20" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <p className="font-bold">Cloud Sync</p>
                    <p className="text-xs text-white/40">Your playlist is automatically synced across all devices.</p>
                  </div>
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <p className="font-bold">Ad-Blocker Notifications</p>
                    <p className="text-xs text-white/40">Show notification when ad-blocker is active.</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-500 rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'admin' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20">
                  <ShieldCheck size={32} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                  <p className="text-white/60">System overview and user management</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <Users size={24} className="text-blue-400 mb-4" />
                  <p className="text-3xl font-bold">{adminStats.totalUsers}</p>
                  <p className="text-sm text-white/40 font-medium">Total Registered Users</p>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <BarChart3 size={24} className="text-emerald-400 mb-4" />
                  <p className="text-3xl font-bold">Active</p>
                  <p className="text-sm text-white/40 font-medium">System Status</p>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <ShieldCheck size={24} className="text-orange-400 mb-4" />
                  <p className="text-3xl font-bold">1</p>
                  <p className="text-sm text-white/40 font-medium">Active Admins</p>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <Clock size={24} className="text-purple-400 mb-4" />
                  <p className="text-3xl font-bold">Live</p>
                  <p className="text-sm text-white/40 font-medium">Real-time Syncing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users size={20} className="text-white/40" />
                    Recent Users
                  </h2>
                  <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-xs uppercase tracking-widest text-white/40">
                        <tr>
                          <th className="px-6 py-4 font-bold">User</th>
                          <th className="px-6 py-4 font-bold">Role</th>
                          <th className="px-6 py-4 font-bold">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {adminStats.recentUsers.map((u, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" />
                                <div>
                                  <p className="font-bold text-sm">{u.displayName}</p>
                                  <p className="text-xs text-white/40">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                                {u.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-white/40">
                              {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Settings size={20} className="text-white/40" />
                    System Logs
                  </h2>
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-4">
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                      <div>
                        <p className="text-sm font-bold">Database Connected</p>
                        <p className="text-xs text-white/40">Firestore instance initialized successfully.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                      <div>
                        <p className="text-sm font-bold">Auth Service Ready</p>
                        <p className="text-xs text-white/40">Firebase Auth provider configured.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <div>
                        <p className="text-sm font-bold">Admin Access Granted</p>
                        <p className="text-xs text-white/40">Verified admin credentials for current session.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'playlist' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[1600px] mx-auto"
            >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">My Playlist</h1>
              <p className="text-xs sm:text-sm text-white/60">{userPlaylist.length} videos • Saved locally</p>
            </div>
            <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
              <button 
                onClick={toggleLoop}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-base transition-all whitespace-nowrap ${isLooping ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60'}`}
              >
                <Repeat className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                {isLooping ? 'Looping On' : 'Looping Off'}
              </button>
              <button 
                onClick={() => setUserPlaylist([])}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold text-xs sm:text-base hover:bg-red-500/20 transition-all whitespace-nowrap"
              >
                <Trash2 className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                Clear All
              </button>
            </div>
          </div>

              {userPlaylist.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                  {userPlaylist.map(video => (
                    <div key={video.id} className="relative group">
                      <VideoCard 
                        video={video} 
                        onClick={() => handleVideoSelect(video)} 
                        onChannelClick={handleChannelClick}
                        onAddToPlaylist={() => {}}
                        isInPlaylist={true}
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromPlaylist(video.id); }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                        title="Remove from Playlist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-4">
                  <div className="bg-white/5 p-8 rounded-full">
                    <List size={64} className="text-white/20" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Your playlist is empty</h2>
                    <p className="text-white/60 max-w-sm">Add videos to your playlist to watch them in sequence without ads.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('home')}
                    className="mt-4 bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-white/90 transition-all"
                  >
                    Explore Videos
                  </button>
                </div>
              )}
            </motion.div>
          ) : apiError ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto">
              <div className="bg-red-500/20 p-6 rounded-full">
                <ShieldAlert size={64} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">YouTube API Error</h2>
                <div className="text-red-400 font-mono text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 mb-4">
                  {apiError.includes('quota') ? (
                    <div className="flex flex-col gap-2">
                      <p className="font-bold">Quota Exceeded</p>
                      <p className="text-xs opacity-80">
                        Batas harian pencarian video sudah habis. 
                      </p>
                      <p className="text-xs font-bold text-emerald-400 mt-2">
                        TAPI TENANG! Anda masih bisa menonton tanpa iklan.
                      </p>
                    </div>
                  ) : (
                    apiError
                  )}
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 mb-6">
                  <p className="text-emerald-400 text-sm font-bold mb-2 flex items-center justify-center gap-2">
                    <PlaySquare size={16} /> CARA TETAP NONTON TANPA IKLAN:
                  </p>
                  <p className="text-white/70 text-xs leading-relaxed">
                    Copy link video dari YouTube, lalu <strong>PASTE</strong> di kotak pencarian di atas dan tekan Enter. Video akan langsung diputar tanpa iklan!
                  </p>
                </div>
              </div>
              <button 
                onClick={() => fetchVideos()}
                className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-white/90 transition-colors"
              >
                Coba Segarkan
              </button>
            </div>
          ) : !YOUTUBE_API_KEY ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto">
              <div className="bg-red-500/20 p-6 rounded-full">
                <ShieldAlert size={64} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">API Key Required</h2>
                <p className="text-white/60">
                  To fetch real videos from YouTube, please add your <strong>YOUTUBE_API_KEY</strong> in the Secrets panel.
                </p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left w-full">
                <p className="text-xs font-mono text-white/40 mb-2 uppercase tracking-widest">Instructions</p>
                <ol className="text-sm text-white/80 list-decimal list-inside flex flex-col gap-2">
                  <li>Go to Google Cloud Console</li>
                  <li>Enable YouTube Data API v3</li>
                  <li>Create an API Key</li>
                  <li>Add it to AI Studio Secrets as <code className="bg-white/10 px-1 rounded">YOUTUBE_API_KEY</code></li>
                </ol>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
                  {selectedVideo ? (
                    <motion.div 
                      key="video-player"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                      <div className="lg:col-span-2 flex flex-col gap-4">
                        <div className="aspect-video bg-black rounded-xl overflow-hidden relative group shadow-2xl">
                          <div id="youtube-player" className="w-full h-full" />
                          {isAdBlockActive && (
                            <div className="absolute top-4 left-4 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <ShieldCheck size={14} />
                              ADS BLOCKED BY SAPUADS
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <h1 className="text-xl font-bold mb-2" dangerouslySetInnerHTML={{ __html: selectedVideo.title }} />
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={selectedVideo.channelAvatar} 
                                alt={selectedVideo.channelName} 
                                className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                referrerPolicy="no-referrer"
                                onClick={(e) => handleChannelClick(e, selectedVideo.channelName)}
                              />
                              <div 
                                className="cursor-pointer group/channel"
                                onClick={(e) => handleChannelClick(e, selectedVideo.channelName)}
                              >
                                <p className="font-bold group-hover/channel:text-blue-400 transition-colors">{selectedVideo.channelName}</p>
                                <p className="text-xs text-white/60">YouTube Creator</p>
                              </div>
                              <button className="ml-4 bg-white text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-white/90 transition-colors">
                                Subscribe
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-white/10 rounded-full overflow-hidden">
                                <button className="flex items-center gap-2 px-4 py-2 hover:bg-white/20 transition-colors border-r border-white/10">
                                  <ThumbsUp size={18} />
                                  <span className="text-sm font-medium">Like</span>
                                </button>
                                <button className="px-4 py-2 hover:bg-white/20 transition-colors">
                                  <ThumbsUp size={18} className="rotate-180" />
                                </button>
                              </div>
                              <button 
                                onClick={toggleLoop}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isLooping ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                                title={isLooping ? "Looping Enabled" : "Looping Disabled"}
                              >
                                <Repeat size={18} className={isLooping ? 'animate-spin-slow' : ''} />
                                <span className="text-sm font-medium">Loop</span>
                              </button>
                              <button 
                                onClick={playNextVideo}
                                className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors"
                                title="Play Next Video"
                              >
                                <PlaySquare size={18} className="text-blue-400" />
                                <span className="text-sm font-medium">Next</span>
                              </button>
                              <button className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors">
                                <Share2 size={18} />
                                <span className="text-sm font-medium">Share</span>
                              </button>
                              <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                                <MoreVertical size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
    
                        <div className="bg-white/5 p-4 rounded-xl">
                          <div className="flex gap-2 text-sm font-bold mb-1">
                            <span>{selectedVideo.views}</span>
                            <span>•</span>
                            <span>Published on {selectedVideo.postedAt}</span>
                          </div>
                          <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                            {selectedVideo.description}
                          </p>
                        </div>
                      </div>
    
                      {/* Recommendations */}
                      <div className="flex flex-col gap-4">
                        <h2 className="font-bold text-lg">Up Next</h2>
                        {(recommendations.length > 0 ? recommendations : videos.filter(v => v.id !== selectedVideo.id)).map(video => (
                          <div 
                            key={video.id} 
                            className="flex gap-3 cursor-pointer group"
                            onClick={() => handleVideoSelect(video)}
                          >
                            <div className="relative w-40 h-24 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden">
                              <img 
                                src={video.thumbnail} 
                                alt={video.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded">
                                {video.duration}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <h3 className="text-sm font-bold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors" dangerouslySetInnerHTML={{ __html: video.title }} />
                              <p 
                                className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                                onClick={(e) => handleChannelClick(e, video.channelName)}
                              >
                                {video.channelName}
                              </p>
                              <p className="text-xs text-white/60">{video.views} • {video.postedAt}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="video-grid"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-8"
                    >
                      {currentChannel && (
                        <div className="flex flex-col gap-6">
                          {currentChannel.banner && (
                            <div className="w-full h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden bg-white/5">
                              <img 
                                src={currentChannel.banner} 
                                alt="Channel Banner" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-4">
                            <img 
                              src={currentChannel.thumbnail} 
                              alt={currentChannel.title} 
                              className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
                              <h1 className="text-3xl md:text-4xl font-bold">{currentChannel.title}</h1>
                              <div className="flex flex-wrap justify-center md:justify-start gap-2 text-white/60 text-sm">
                                <span>{currentChannel.customUrl}</span>
                                <span>•</span>
                                <span>{currentChannel.subscriberCount} subscribers</span>
                                <span>•</span>
                                <span>{currentChannel.videoCount} videos</span>
                              </div>
                              <p className="text-sm text-white/80 max-w-2xl line-clamp-2 mt-2">
                                {currentChannel.description}
                              </p>
                              <div className="flex gap-3 mt-4">
                                <button className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-white/90 transition-colors">
                                  Subscribe
                                </button>
                                <button className="bg-white/10 text-white px-6 py-2 rounded-full font-bold hover:bg-white/20 transition-colors">
                                  Join
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="border-b border-white/10 flex gap-8 px-4 overflow-x-auto scrollbar-hide">
                            {['Home', 'Videos', 'Shorts', 'Playlists', 'Community'].map((tab, i) => (
                              <button key={tab} className={`pb-3 text-sm font-bold whitespace-nowrap ${i === 1 ? 'border-b-2 border-white' : 'text-white/60 hover:text-white'}`}>
                                {tab}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                        {videos.map(video => (
                          <VideoCard 
                            key={video.id} 
                            video={video} 
                            onClick={() => handleVideoSelect(video)} 
                            onChannelClick={handleChannelClick}
                            onAddToPlaylist={() => addToPlaylist(video)}
                            isInPlaylist={userPlaylist.some(v => v.id === video.id)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-white/10 flex items-center justify-around py-2 z-50">
        <button 
          onClick={() => {
            setActiveTab('home');
            setSelectedVideo(null);
            setCurrentChannel(null);
            fetchVideos();
          }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'home' && !selectedVideo && !currentChannel ? 'text-white' : 'text-white/40'}`}
        >
          <Home size={20} />
          <span className="text-[10px]">Home</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('trending');
            setSelectedVideo(null);
            setCurrentChannel(null);
            fetchVideos('trending');
          }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'trending' ? 'text-white' : 'text-white/40'}`}
        >
          <Compass size={20} />
          <span className="text-[10px]">Trending</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('playlist');
            setSelectedVideo(null);
            setCurrentChannel(null);
          }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'playlist' ? 'text-white' : 'text-white/40'}`}
        >
          <List size={20} />
          <span className="text-[10px]">Playlist</span>
        </button>
        <button 
          onClick={() => setIsAdBlockActive(!isAdBlockActive)}
          className={`flex flex-col items-center gap-1 ${isAdBlockActive ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {isAdBlockActive ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          <span className="text-[10px]">{isAdBlockActive ? 'Safe' : 'Ads'}</span>
        </button>
      </nav>

      {/* Ad-Blocker Notification */}
      <AnimatePresence>
        {showAdBlockNotification && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] border border-emerald-400/30"
          >
            <div className="bg-white/20 p-2 rounded-full">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="font-bold">SapuAds Active</h4>
              <p className="text-sm opacity-90">All intrusive ads have been blocked.</p>
            </div>
            <button 
              onClick={() => setShowAdBlockNotification(false)}
              className="ml-4 p-1 hover:bg-white/10 rounded-full"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick, isOpen }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isOpen: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-5 p-3 rounded-xl transition-all ${
        active ? 'bg-white/10 font-bold' : 'hover:bg-white/5 text-white/80'
      } ${!isOpen ? 'justify-center' : ''}`}
    >
      <div className={`${active ? 'text-white' : 'text-white/70'}`}>
        {icon}
      </div>
      {isOpen && <span className="text-sm">{label}</span>}
    </button>
  );
}

const VideoCard: React.FC<{ 
  video: Video; 
  onClick: () => void;
  onChannelClick: (e: React.MouseEvent, name: string) => void;
  onAddToPlaylist: () => void;
  isInPlaylist: boolean;
}> = ({ video, onClick, onChannelClick, onAddToPlaylist, isInPlaylist }) => {
  return (
    <div 
      className="flex flex-col gap-3 cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-white/5 rounded-xl overflow-hidden">
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <span className="absolute bottom-2 right-2 bg-black/80 text-xs font-bold px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
        
        {/* Add to Playlist Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onAddToPlaylist(); }}
          className={`absolute top-2 right-2 p-2 rounded-full transition-all z-10 shadow-lg ${
            isInPlaylist 
              ? 'bg-emerald-500 text-white opacity-100 scale-110' 
              : 'bg-black/80 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-600'
          }`}
          title={isInPlaylist ? "Added to Playlist" : "Add to Playlist"}
        >
          {isInPlaylist ? <ShieldCheck size={20} /> : <Plus size={20} />}
        </button>

        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
            <PlaySquare size={32} fill="white" />
          </div>
        </div>
      </div>
      
      <div className="flex gap-3">
        <img 
          src={video.channelAvatar} 
          alt={video.channelName} 
          className="w-9 h-9 rounded-full flex-shrink-0 hover:opacity-80 transition-opacity"
          referrerPolicy="no-referrer"
          onClick={(e) => onChannelClick(e, video.channelName)}
        />
        <div className="flex flex-col gap-1 flex-1">
          <h3 className="font-bold line-clamp-2 leading-tight text-sm sm:text-[15px] group-hover:text-blue-400 transition-colors" dangerouslySetInnerHTML={{ __html: video.title }} />
          <div className="flex items-center justify-between">
            <p 
              className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1 hover:text-white transition-colors cursor-pointer"
              onClick={(e) => onChannelClick(e, video.channelName)}
            >
              {video.channelName}
            </p>
          </div>
          <p className="text-[10px] sm:text-sm text-white/60">
            {video.views} • {video.postedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
