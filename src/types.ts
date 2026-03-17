export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  channelName: string;
  channelAvatar: string;
  views: string;
  postedAt: string;
  duration: string;
  description: string;
}

const formatDuration = (duration: string): string => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return "0:00";
  
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatViews = (views: string): string => {
  const num = parseInt(views);
  if (isNaN(num)) return "0 views";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M views";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K views";
  return num + " views";
};

export const getYouTubeVideos = async (query: string = 'trending', apiKey: string): Promise<{ videos: Video[], error?: string }> => {
  try {
    // Step 1: Search for videos
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=24&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`
    );
    const searchData = await searchResponse.json();

    if (searchData.error) {
      return { videos: [], error: searchData.error.message || "Unknown YouTube API Error" };
    }

    if (!searchData.items || searchData.items.length === 0) return { videos: [] };

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const channelIds = [...new Set(searchData.items.map((item: any) => item.snippet.channelId))].join(',');

    // Step 2: Get detailed info (statistics, contentDetails)
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );
    const detailsData = await detailsResponse.json();

    // Step 3: Get channel avatars
    const channelsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds}&key=${apiKey}`
    );
    const channelsData = await channelsResponse.json();

    const channelAvatars: { [key: string]: string } = {};
    channelsData.items?.forEach((channel: any) => {
      channelAvatars[channel.id] = channel.snippet.thumbnails.default.url;
    });

    const videos = detailsData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      videoUrl: `https://www.youtube.com/embed/${item.id}`,
      channelName: item.snippet.channelTitle,
      channelAvatar: channelAvatars[item.snippet.channelId] || `https://picsum.photos/seed/${item.snippet.channelId}/40/40`,
      views: formatViews(item.statistics.viewCount),
      postedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
      duration: formatDuration(item.contentDetails.duration),
      description: item.snippet.description
    }));

    return { videos };
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
    return { videos: [], error: error instanceof Error ? error.message : "Network Error" };
  }
};
