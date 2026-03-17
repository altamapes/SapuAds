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

export const MOCK_VIDEOS: Video[] = [
  {
    id: "1",
    title: "Relaxing Nature Scenery - 4K Ultra HD",
    thumbnail: "https://picsum.photos/seed/nature1/640/360",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Nature Hub",
    channelAvatar: "https://picsum.photos/seed/avatar1/40/40",
    views: "1.2M views",
    postedAt: "2 days ago",
    duration: "10:05",
    description: "Experience the beauty of nature in stunning 4K resolution. Perfect for relaxation and meditation."
  },
  {
    id: "2",
    title: "Modern Architecture Trends 2024",
    thumbnail: "https://picsum.photos/seed/arch/640/360",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    channelName: "Design Daily",
    channelAvatar: "https://picsum.photos/seed/avatar2/40/40",
    views: "850K views",
    postedAt: "1 week ago",
    duration: "15:20",
    description: "Exploring the most innovative architectural designs of the year."
  },
  {
    id: "3",
    title: "The Future of Artificial Intelligence",
    thumbnail: "https://picsum.photos/seed/tech/640/360",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Tech Insights",
    channelAvatar: "https://picsum.photos/seed/avatar3/40/40",
    views: "2.5M views",
    postedAt: "3 weeks ago",
    duration: "12:45",
    description: "How AI is changing the world as we know it."
  },
  {
    id: "4",
    title: "Gourmet Cooking Masterclass: Italian Pasta",
    thumbnail: "https://picsum.photos/seed/food/640/360",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    channelName: "Chef's Table",
    channelAvatar: "https://picsum.photos/seed/avatar4/40/40",
    views: "500K views",
    postedAt: "1 month ago",
    duration: "20:10",
    description: "Learn how to make authentic Italian pasta from scratch."
  },
  {
    id: "5",
    title: "Cyberpunk Cityscape - Lo-Fi Beats",
    thumbnail: "https://picsum.photos/seed/cyber/640/360",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Lo-Fi Beats",
    channelAvatar: "https://picsum.photos/seed/avatar5/40/40",
    views: "4.1M views",
    postedAt: "2 months ago",
    duration: "1:00:00",
    description: "Chilled beats for studying and relaxing."
  },
  {
    id: "6",
    title: "Space Exploration: Journey to Mars",
    thumbnail: "https://picsum.photos/seed/space/640/360",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    channelName: "Cosmos TV",
    channelAvatar: "https://picsum.photos/seed/avatar6/40/40",
    views: "1.8M views",
    postedAt: "5 days ago",
    duration: "18:30",
    description: "The latest updates on our mission to the Red Planet."
  }
];
