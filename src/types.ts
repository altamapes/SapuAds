export interface Channel {
  id: string;
  title: string;
  customUrl: string;
  description: string;
  thumbnail: string;
  banner: string;
  subscriberCount: string;
  videoCount: string;
}

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

const formatCount = (count: string): string => {
  const num = parseInt(count);
  if (isNaN(num)) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

export const getYouTubeVideos = async (query: string = 'trending', apiKey: string): Promise<{ videos: Video[], channel?: Channel, error?: string }> => {
  try {
    // Step 1: Search for both videos and channels to find the best match
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=${encodeURIComponent(query)}&type=video,channel&key=${apiKey}`
    );
    const searchData = await searchResponse.json();

    if (searchData.error) {
      return { videos: [], error: searchData.error.message || "Unknown YouTube API Error" };
    }

    if (!searchData.items || searchData.items.length === 0) return { videos: [] };

    // Find if there's a channel that matches the query exactly
    const matchedChannelItem = searchData.items.find((item: any) => 
      item.id.kind === 'youtube#channel' && 
      (item.snippet.title.toLowerCase() === query.toLowerCase() || 
       item.snippet.channelTitle.toLowerCase() === query.toLowerCase())
    );

    let channelInfo: Channel | undefined;
    if (matchedChannelItem) {
      const channelDetailResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${matchedChannelItem.id.channelId}&key=${apiKey}`
      );
      const channelDetailData = await channelDetailResponse.json();
      const channel = channelDetailData.items?.[0];
      
      if (channel) {
        channelInfo = {
          id: channel.id,
          title: channel.snippet.title,
          customUrl: channel.snippet.customUrl || `@${channel.snippet.title.replace(/\s+/g, '').toLowerCase()}`,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url,
          banner: channel.brandingSettings?.image?.bannerExternalUrl || '',
          subscriberCount: formatCount(channel.statistics.subscriberCount),
          videoCount: channel.statistics.videoCount
        };
      }
    }

    const videoItems = searchData.items.filter((item: any) => item.id.kind === 'youtube#video');

    // Enhanced Sort logic with scoring system
    const getScore = (item: any, q: string) => {
      const title = item.snippet.title.toLowerCase();
      const channel = item.snippet.channelTitle.toLowerCase();
      const queryLower = q.toLowerCase();
      let score = 0;

      // Exact matches
      if (channel === queryLower) score += 100;
      if (title === queryLower) score += 90;

      // Starts with
      if (title.startsWith(queryLower)) score += 70;
      if (channel.startsWith(queryLower)) score += 60;

      // Contains
      if (title.includes(queryLower)) score += 40;
      if (channel.includes(queryLower)) score += 30;

      return score;
    };

    const sortedItems = [...videoItems].sort((a: any, b: any) => {
      const scoreA = getScore(a, query);
      const scoreB = getScore(b, query);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }
      
      return 0; // Maintain original YouTube relevance if scores are equal
    });

    if (sortedItems.length === 0) return { videos: [], channel: channelInfo };

    const videoIds = sortedItems.map((item: any) => item.id.videoId).join(',');
    const channelIds = [...new Set(sortedItems.map((item: any) => item.snippet.channelId))].join(',');

    // Step 2: Get detailed info
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

    // Map back to our Video interface, maintaining the sorted order from Step 1
    const videosMap = new Map();
    detailsData.items?.forEach((item: any) => {
      videosMap.set(item.id, {
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        videoUrl: `https://www.youtube-nocookie.com/embed/${item.id}`,
        channelName: item.snippet.channelTitle,
        channelAvatar: channelAvatars[item.snippet.channelId] || `https://picsum.photos/seed/${item.snippet.channelId}/40/40`,
        views: formatViews(item.statistics.viewCount),
        postedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
        duration: formatDuration(item.contentDetails.duration),
        description: item.snippet.description
      });
    });

    // Reconstruct the array based on sorted search results
    const videos = sortedItems
      .map((item: any) => videosMap.get(item.id.videoId))
      .filter(v => v !== undefined);

    return { videos, channel: channelInfo };
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
    return { videos: [], error: error instanceof Error ? error.message : "Network Error" };
  }
};
