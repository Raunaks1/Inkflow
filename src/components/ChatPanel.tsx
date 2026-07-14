import { Send, Users } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, RemoteCursor } from '../hooks/useMultiplayer';

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => void;
  remoteCursors: Record<number, RemoteCursor>;
  myName: string;
  isShared: boolean;
}

export function ChatPanel({
  chatMessages,
  sendChatMessage,
  remoteCursors,
  myName,
  isShared,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const connectedUsersCount = Object.keys(remoteCursors).length + (isShared ? 1 : 0);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  if (!isShared) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-20 right-4 z-40 bg-[var(--panel-bg)] border-[var(--panel-border)] p-3 rounded-full shadow-lg backdrop-blur-md hover:scale-105 transition-transform"
      >
        <div className="relative">
          <Users size={20} className="text-[var(--text-color)]" />
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
            {connectedUsersCount}
          </div>
        </div>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute top-36 right-4 w-80 h-[500px] max-h-[60vh] bg-[var(--panel-bg)] border border-[var(--panel-border)] shadow-xl rounded-xl z-40 flex flex-col backdrop-blur-xl overflow-hidden animation-slide-in">
          {/* Header */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]/50 backdrop-blur flex justify-between items-center">
            <h3 className="font-bold text-sm text-[var(--text-color)] flex items-center gap-2">
              <Users size={16} /> Online ({connectedUsersCount})
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--text-color)] opacity-60 hover:opacity-100 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* User List */}
          <div className="flex px-3 py-2 gap-2 overflow-x-auto border-b border-[var(--panel-border)]/50 shrink-0 hide-scrollbar">
            {/* Myself */}
            <div className="flex flex-col items-center shrink-0 w-12" title={`${myName} (You)`}>
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-green-500 flex items-center justify-center text-xs font-bold shadow-sm">
                {(myName || 'Me').charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-[var(--text-color)] mt-1 truncate w-full text-center">
                You
              </span>
            </div>
            {/* Remote Users */}
            {Object.values(remoteCursors).map((cursor, idx) => (
              <div key={idx} className="flex flex-col items-center shrink-0 w-12" title={cursor.name}>
                <div 
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: cursor.color, borderColor: cursor.color }}
                >
                  {(cursor.name || 'A').charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] text-[var(--text-color)] mt-1 truncate w-full text-center">
                  {cursor.name || 'Anon'}
                </span>
              </div>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-color)] opacity-50 my-auto">
                No messages yet. Say hello!
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.name === myName;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                    {!isMe && (
                      <span className="text-[10px] font-medium opacity-70 mb-0.5 ml-1" style={{ color: msg.color }}>
                        {msg.name}
                      </span>
                    )}
                    <div 
                      className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-blue-500 text-white rounded-br-sm' 
                          : 'bg-slate-100 dark:bg-slate-800 text-[var(--text-color)] border border-[var(--panel-border)] rounded-bl-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-[var(--panel-border)] bg-[var(--panel-bg)]/50 backdrop-blur">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  sendChatMessage(input.trim());
                  setInput('');
                }
              }}
              className="relative"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-[var(--panel-border)] rounded-full py-2 pl-4 pr-10 text-sm text-[var(--text-color)] focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-1 top-1 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
              >
                <Send size={14} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
