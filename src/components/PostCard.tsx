import React from "react";
import { Post } from "../types";
import { Youtube, Calendar, ArrowUpRight, User, Clock, AlertCircle } from "lucide-react";

interface PostCardProps {
  key?: React.Key;
  post: Post;
  onClick: () => void;
}

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  "Foreign Policy": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&q=80&w=600",
  "Domestic Politics": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&q=80&w=600",
  "Economy": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=600",
  "Opinion": "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=600",
  "Society & Tech": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600",
};

export default function PostCard({ post, onClick }: PostCardProps) {
  const displayImage = post.imageUrls && post.imageUrls.length > 0 
    ? post.imageUrls[0] 
    : FALLBACK_CATEGORY_IMAGES[post.category] || FALLBACK_CATEGORY_IMAGES["Opinion"];

  return (
    <div
      onClick={onClick}
      className="bg-white border-2 border-[#141414] p-6 flex flex-col justify-between cursor-pointer group shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-[#2C5E5A] hover:bg-[#FBFBFA] transition-all duration-300 ease-out focus-within:outline-none focus-within:ring-2 focus-within:ring-[#141414] rounded-none transform-gpu will-change-transform"
      style={{ contentVisibility: "auto" }}
    >
      <div>
        {/* Top bar with category and media indicators */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-[#141414]/10">
          <span className="bg-[#9D3534] text-white px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] font-bold select-none border border-black/10">
            {post.category}
          </span>
          <div className="flex items-center gap-2">
            {post.youtubeId ? (
              <span className="font-mono text-[9px] text-[#9D3534] bg-[#9D3534]/10 flex items-center gap-1 px-2 py-0.5 border border-[#9D3534]/30 uppercase font-bold tracking-tight">
                <Youtube size={11} className="stroke-[2.5]" /> Broadcast
              </span>
            ) : (
              <span className="font-mono text-[9px] text-stone-700 bg-stone-100 px-2 py-0.5 border border-stone-300 uppercase font-bold tracking-tight">
                Briefing
              </span>
            )}
            {post.isDraft && (
              <span className="font-mono text-[9px] text-amber-800 bg-amber-100 px-1.5 py-0.5 uppercase font-extrabold border border-amber-300 tracking-tight">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* Post Image Thumbnail Preview (Always rendered for newsprint visual impact) */}
        <div className="mb-4 overflow-hidden border-2 border-[#141414] aspect-[16/9] bg-[#FAF8F5] relative group-hover:border-[#2C5E5A] transition-colors">
          <img 
            src={displayImage} 
            alt={post.title} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-all duration-300"
            onError={(e) => {
              (e.target as HTMLElement).parentElement!.style.display = "none";
            }}
          />
        </div>

        {/* Title */}
        <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-[#141414] group-hover:text-[#2C5E5A] leading-tight mb-3 group-hover:underline decoration-[#2C5E5A] decoration-2 underline-offset-4 transition-colors duration-150">
          {post.title}
        </h3>

        {/* Executive summary */}
        <p className="font-serif text-stone-700 text-sm leading-relaxed mb-4 block font-normal line-clamp-3">
          {post.summary}
        </p>
      </div>

      {/* Footer statistics and metadata */}
      <div className="pt-3 border-t border-[#141414]/10 flex justify-between items-center font-mono text-[10px] text-stone-500 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#141414]/70">
            <User size={12} className="text-[#9D3534]" />
            <span className="truncate max-w-[90px]">{post.author}</span>
          </span>
          <span className="opacity-40">//</span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock size={12} />
            <span>{post.readTime} min</span>
          </span>
        </div>
        <div className="flex items-center gap-1 group-hover:text-[#9D3534] transition-colors font-bold uppercase tracking-wider text-[10px] text-stone-700">
          <span>Explore</span>
          <ArrowUpRight size={14} className="transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
}
