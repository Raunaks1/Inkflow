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
    <div className="absolute top-4 right-4 z-40 flex items-center gap-3">
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
        className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all duration-200 backdrop-blur-md border ${
          isShared
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
            : 'bg-white/80 dark:bg-[#1a2235]/80 border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-300 hover:scale-105'
        }`}
      >
        {copied ? (
          <Check size={18} className="text-green-500" />
        ) : isShared ? (
          <Users size={18} />
        ) : (
          <Share2 size={18} />
        )}
        <span className="text-sm font-medium">
          {copied ? 'Copied!' : isShared ? 'Copy Link' : 'Share Session'}
        </span>
      </button>
    </div>
  );
}
