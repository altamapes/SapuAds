import { GoogleGenAI, Type } from "@google/genai";

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
  channelId: string;
  channelAvatar: string;
  views: string;
  postedAt: string;
  duration: string;
  description: string;
  folder?: string;
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
    if (!apiKey) {
      return { videos: [], error: 'API Key missing' };
    }

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
        channelId: item.snippet.channelId,
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

export const getChannelVideos = async (channelId: string, apiKey: string): Promise<{ videos: Video[], error?: string }> => {
  try {
    if (!apiKey) return { videos: [] };

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=20&order=date&type=video&key=${apiKey}`
    );
    const data = await response.json();

    if (data.error) {
      return { videos: [], error: data.error.message };
    }

    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');

    // Get detailed info
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );
    const detailsData = await detailsResponse.json();

    // Get channel avatar
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    const avatar = channelData.items?.[0]?.snippet?.thumbnails?.default?.url || '';

    const videos = detailsData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      videoUrl: `https://www.youtube-nocookie.com/embed/${item.id}`,
      channelName: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      channelAvatar: avatar,
      views: formatViews(item.statistics.viewCount),
      postedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
      duration: formatDuration(item.contentDetails.duration),
      description: item.snippet.description
    }));

    return { videos };
  } catch (error) {
    console.error("Error fetching channel videos:", error);
    return { videos: [], error: error instanceof Error ? error.message : "Network Error" };
  }
};

export const getChannelDetails = async (channelId: string, apiKey: string): Promise<Channel | null> => {
  try {
    if (!apiKey) return null;

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`
    );
    const data = await response.json();

    if (data.error || !data.items || data.items.length === 0) return null;

    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      customUrl: item.snippet.customUrl || '',
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      banner: item.brandingSettings.image?.bannerExternalUrl || '',
      subscriberCount: formatCount(item.statistics.subscriberCount),
      videoCount: item.statistics.videoCount
    };
  } catch (error) {
    console.error("Error fetching channel details:", error);
    return null;
  }
};

const enrichWithGemini = async (videoId: string): Promise<Partial<Video> | null> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. Enrichment disabled.");
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for YouTube video ID "${videoId}" and extract its metadata.
      Return a JSON object with:
      - title: The exact video title.
      - channelName: The name of the channel that uploaded it.
      - duration: The video duration (e.g., "4:15" or "1:20:30").
      - views: Total view count formatted (e.g., "1.2M views" or "45K views").
      - postedAt: The upload date formatted (e.g., "Mar 15, 2024" or "2 days ago").
      - description: A brief summary of the video.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            channelName: { type: Type.STRING },
            duration: { type: Type.STRING },
            views: { type: Type.STRING },
            postedAt: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "channelName", "duration", "views", "postedAt", "description"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini enrichment error:", error);
    return null;
  }
};

export const getVideoDetails = async (videoId: string, apiKey: string): Promise<Video | null> => {
  try {
    // Try YouTube Data API first if key is available
    if (apiKey) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`
      );
      const data = await response.json();

      if (!data.error && data.items && data.items.length > 0) {
        const item = data.items[0];

        // Get channel avatar
        const channelResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${item.snippet.channelId}&key=${apiKey}`
        );
        const channelData = await channelResponse.json();
        const avatar = channelData.items?.[0]?.snippet?.thumbnails?.default?.url || '';

        return {
          id: item.id,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          videoUrl: `https://www.youtube-nocookie.com/embed/${item.id}`,
          channelName: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          channelAvatar: avatar,
          views: formatViews(item.statistics.viewCount),
          postedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
          duration: formatDuration(item.contentDetails.duration),
          description: item.snippet.description
        };
      }
    }

    // Fallback to Gemini Enrichment if API fails or key is missing
    const geminiData = await enrichWithGemini(videoId);
    
    // Fallback to oEmbed (doesn't require API key) for basic info
    const oEmbedResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oEmbedResponse.ok) {
      const oEmbedData = await oEmbedResponse.json();
      const channelName = geminiData?.channelName || oEmbedData.author_name || "YouTube";
      return {
        id: videoId,
        title: geminiData?.title || oEmbedData.title || "Video dari Link",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        channelName: channelName,
        channelId: "",
        channelAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=random&color=fff`,
        views: geminiData?.views || "Direct Play",
        postedAt: geminiData?.postedAt || "Sekarang",
        duration: geminiData?.duration || "--:--",
        description: geminiData?.description || "Memutar langsung dari link."
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching video details:", error);
    return null;
  }
};
