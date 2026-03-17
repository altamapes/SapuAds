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

export const getYouTubeVideos = async (query: string = 'trending', apiKey: string): Promise<{ videos: Video[], error?: string }> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`
    );
    const data = await response.json();

    if (data.error) {
      return { videos: [], error: data.error.message || "Unknown YouTube API Error" };
    }

    if (!data.items) return { videos: [] };

    const videos = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high.url,
      videoUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
      channelName: item.snippet.channelTitle,
      channelAvatar: `https://picsum.photos/seed/${item.snippet.channelId}/40/40`,
      views: "1M+ views",
      postedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
      duration: "10:00",
      description: item.snippet.description
    }));

    return { videos };
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
    return { videos: [], error: error instanceof Error ? error.message : "Network Error" };
  }
};
