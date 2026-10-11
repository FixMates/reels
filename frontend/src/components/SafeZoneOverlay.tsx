import React from 'react';

interface SafeZoneOverlayProps {
  platform: 'reels' | 'tiktok' | 'shorts';
  visible: boolean;
}

export const SafeZoneOverlay: React.FC<SafeZoneOverlayProps> = ({ platform, visible }) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
      {/* Top zone (username / search / progress) */}
      <div className="absolute top-0 left-0 right-0 h-[10%] bg-red-500/15 border-b border-dashed border-red-500/40 flex items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-red-400 bg-black/60 px-2 py-0.5 rounded">
          {platform.toUpperCase()} Top Bar Zone
        </span>
      </div>

      {/* Right side interactions zone (Like, Comment, Share, Audio disk) */}
      <div className="absolute top-[35%] bottom-[15%] right-0 w-[18%] bg-red-500/15 border-l border-dashed border-red-500/40 flex flex-col items-center justify-center gap-4">
        <div className="w-5 h-5 rounded-full border border-red-400/60 flex items-center justify-center text-[9px] text-red-300">♥</div>
        <div className="w-5 h-5 rounded-full border border-red-400/60 flex items-center justify-center text-[9px] text-red-300">💬</div>
        <div className="w-5 h-5 rounded-full border border-red-400/60 flex items-center justify-center text-[9px] text-red-300">↗</div>
        <span className="text-[8px] uppercase tracking-wider font-semibold text-red-400 rotate-90 whitespace-nowrap">
          Icons Zone
        </span>
      </div>

      {/* Bottom zone (Handle, Caption, Audio ticker) */}
      <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-red-500/15 border-t border-dashed border-red-500/40 flex flex-col items-start justify-end p-3">
        <div className="w-32 h-2.5 bg-red-400/30 rounded mb-1.5" />
        <div className="w-48 h-2 bg-red-400/20 rounded mb-1" />
        <span className="text-[9px] uppercase tracking-wider font-semibold text-red-400 bg-black/60 px-2 py-0.5 rounded">
          {platform.toUpperCase()} Caption & Handle Area
        </span>
      </div>

      {/* Center Safe Zone Outline */}
      <div className="absolute top-[12%] bottom-[24%] left-[6%] right-[20%] border border-emerald-400/50 rounded-lg pointer-events-none flex items-start justify-start p-1.5">
        <span className="text-[9px] uppercase font-bold text-emerald-400 bg-black/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
          Safe Visual Content Area
        </span>
      </div>
    </div>
  );
};
