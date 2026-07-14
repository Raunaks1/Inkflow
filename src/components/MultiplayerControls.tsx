import { useState } from 'react';
import { Share2, Users, Check } from 'lucide-react';

interface MultiplayerControlsProps {
  isShared: boolean;
  shareSession: () => void;
  myName: string;
  updateMyName: (name: string) => void;
}

export function MultiplayerControls({
  isShared,
  shareSession,
  myName,
  updateMyName,
}: MultiplayerControlsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myName || '');
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (!isShared) {
      shareSession();
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateMyName(nameInput.trim());
      setIsEditingName(false);
    }
  };

  return (
    <div className="flex items-center gap-3 relative z-40">
      {/* Name editor if shared */}
      {isShared && (
        <div className="bg-white/80 dark:bg-[#1a2235]/80 backdrop-blur-md rounded-xl p-1.5 flex items-center shadow-sm border border-slate-200/50 dark:border-slate-800/50 gap-2">
          {isEditingName || !myName ? (
            <div className="flex items-center">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="Enter your name..."
                className="bg-transparent border-none outline-none text-sm px-2 w-32 dark:text-white"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-500"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Change your display name"
            >
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {myName}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Share Button */}
      <button
        onClick={handleShare}
        className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 ${
          isShared
            ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:from-emerald-500/20 hover:to-teal-500/20 shadow-emerald-500/10'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-400/50 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/40 hover:shadow-xl'
        }`}
      >
        {copied ? (
          <Check size={18} className={isShared ? "text-emerald-500" : "text-white"} />
        ) : isShared ? (
          <Users size={18} className="animate-pulse" />
        ) : (
          <Share2 size={18} className="group-hover:rotate-12 transition-transform" />
        )}
        <span className="text-sm tracking-wide">
          {copied ? 'Copied!' : isShared ? 'Copy Link' : 'Share Session'}
        </span>
        
        {/* Subtle glow underneath */}
        {!isShared && (
          <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-0 blur-md -z-10 group-hover:opacity-30 transition-opacity duration-300"></div>
        )}
      </button>
    </div>
  );
}
