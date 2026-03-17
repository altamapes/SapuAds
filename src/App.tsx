/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Clock, 
  ThumbsUp, 
  Share2, 
  MoreVertical,
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_VIDEOS, Video } from './types';

export default function App() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isAdBlockActive, setIsAdBlockActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAdBlockNotification, setShowAdBlockNotification] = useState(false);

  useEffect(() => {
    if (isAdBlockActive) {
      setShowAdBlockNotification(true);
      const timer = setTimeout(() => setShowAdBlockNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAdBlockActive]);

  const filteredVideos = MOCK_VIDEOS.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 sticky top-0 bg-[#0f0f0f] z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Menu size={24} />
          </button>
          <div 
            className="flex items-center gap-1 cursor-pointer" 
            onClick={() => setSelectedVideo(null)}
          >
            <div className="bg-red-600 p-1 rounded-lg">
              <PlaySquare size={20} fill="white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">SapuAds</span>
          </div>
        </div>

        <div className="flex items-center flex-1 max-w-2xl px-4">
          <div className="flex items-center flex-1 bg-[#121212] border border-white/10 rounded-full overflow-hidden focus-within:border-blue-500">
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full bg-transparent px-4 py-2 outline-none text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="bg-white/10 px-5 py-2 border-l border-white/10 hover:bg-white/20 transition-colors">
              <Search size={20} />
            </button>
          </div>
          <button className="ml-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <Mic size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAdBlockActive(!isAdBlockActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
              isAdBlockActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {isAdBlockActive ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            <span className="text-sm font-medium hidden sm:inline">
              {isAdBlockActive ? 'Ad-Blocker Active' : 'Ad-Blocker Disabled'}
            </span>
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block">
            <VideoIcon size={24} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block">
            <Bell size={24} />
          </button>
          <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <User size={20} />
            </div>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} hidden md:flex flex-col gap-2 p-2 overflow-y-auto transition-all duration-300 border-r border-white/5`}>
          <SidebarItem icon={<Home size={22} />} label="Home" active={!selectedVideo} onClick={() => setSelectedVideo(null)} isOpen={isSidebarOpen} />
          <SidebarItem icon={<Compass size={22} />} label="Explore" isOpen={isSidebarOpen} />
          <SidebarItem icon={<PlaySquare size={22} />} label="Subscriptions" isOpen={isSidebarOpen} />
          <hr className="border-white/10 my-2" />
          <SidebarItem icon={<Clock size={22} />} label="History" isOpen={isSidebarOpen} />
          <SidebarItem icon={<ThumbsUp size={22} />} label="Liked Videos" isOpen={isSidebarOpen} />
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
        <main className="flex-1 overflow-y-auto bg-[#0f0f0f] p-4">
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
                  <div className="aspect-video bg-black rounded-xl overflow-hidden relative group">
                    <video 
                      src={selectedVideo.videoUrl} 
                      controls 
                      autoPlay 
                      className="w-full h-full"
                    />
                    {isAdBlockActive && (
                      <div className="absolute top-4 left-4 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <ShieldCheck size={14} />
                        ADS BLOCKED BY SAPUADS
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h1 className="text-xl font-bold mb-2">{selectedVideo.title}</h1>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={selectedVideo.channelAvatar} 
                          alt={selectedVideo.channelName} 
                          className="w-10 h-10 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold">{selectedVideo.channelName}</p>
                          <p className="text-xs text-white/60">1.2M subscribers</p>
                        </div>
                        <button className="ml-4 bg-white text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-white/90 transition-colors">
                          Subscribe
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/10 rounded-full overflow-hidden">
                          <button className="flex items-center gap-2 px-4 py-2 hover:bg-white/20 transition-colors border-r border-white/10">
                            <ThumbsUp size={18} />
                            <span className="text-sm font-medium">124K</span>
                          </button>
                          <button className="px-4 py-2 hover:bg-white/20 transition-colors">
                            <ThumbsUp size={18} className="rotate-180" />
                          </button>
                        </div>
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
                      <span>{selectedVideo.postedAt}</span>
                    </div>
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {selectedVideo.description}
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="flex flex-col gap-4">
                  <h2 className="font-bold text-lg">Up Next</h2>
                  {MOCK_VIDEOS.filter(v => v.id !== selectedVideo.id).map(video => (
                    <div 
                      key={video.id} 
                      className="flex gap-3 cursor-pointer group"
                      onClick={() => setSelectedVideo(video)}
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
                        <h3 className="text-sm font-bold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                          {video.title}
                        </h3>
                        <p className="text-xs text-white/60">{video.channelName}</p>
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
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8"
              >
                {filteredVideos.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onClick={() => setSelectedVideo(video)} 
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

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

const VideoCard: React.FC<{ video: Video; onClick: () => void }> = ({ video, onClick }) => {
  return (
    <div 
      className="flex flex-col gap-3 cursor-pointer group"
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
          className="w-9 h-9 rounded-full flex-shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="flex flex-col gap-1">
          <h3 className="font-bold line-clamp-2 leading-tight text-[15px] group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          <p className="text-sm text-white/60 mt-1">{video.channelName}</p>
          <p className="text-sm text-white/60">
            {video.views} • {video.postedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
