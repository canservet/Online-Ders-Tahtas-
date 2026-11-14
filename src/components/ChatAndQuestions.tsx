import React, { useState } from 'react';
import type { ChatMessage } from '../types/whiteboard.ts';
import { Send, MessageSquare, HelpCircle, CheckCircle2, User, X } from 'lucide-react';

interface ChatAndQuestionsProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, isQuestion: boolean) => void;
  onMarkAnswered: (messageId: string) => void;
  currentUserId: string;
  isTeacher: boolean;
}

export const ChatAndQuestions: React.FC<ChatAndQuestionsProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onMarkAnswered,
  currentUserId,
  isTeacher,
}) => {
  const [inputText, setInputText] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'questions'>('all');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), isQuestion);
    setInputText('');
    setIsQuestion(false);
  };

  const filteredMessages = filterMode === 'questions' 
    ? messages.filter(m => m.isQuestion)
    : messages;

  return (
    <div className="fixed top-14 right-3 bottom-24 w-80 sm:w-96 bg-black/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">Canlı Ders Sohbeti & Soru-Cevap</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-zinc-800 px-3 py-1.5 gap-2 bg-zinc-950 text-xs font-medium">
        <button
          onClick={() => setFilterMode('all')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filterMode === 'all' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Tüm Mesajlar ({messages.length})
        </button>
        <button
          onClick={() => setFilterMode('questions')}
          className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
            filterMode === 'questions' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Sorular ({messages.filter(m => m.isQuestion).length})</span>
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-zinc-400" />
            <p className="text-xs">Henüz mesaj yok.</p>
            <p className="text-[11px] text-zinc-500 mt-1">Dersle ilgili soru veya yorum yazabilirsiniz.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div 
                key={msg.id}
                className={`p-2.5 rounded-xl text-xs space-y-1 transition-all ${
                  msg.isQuestion
                    ? msg.isAnswered
                      ? 'bg-zinc-950 border border-zinc-700 text-zinc-300'
                      : 'bg-zinc-900 border border-zinc-600 text-white'
                    : isMe 
                      ? 'bg-zinc-800 border border-zinc-700 text-white ml-4'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className={msg.senderRole === 'teacher' ? 'text-white' : 'text-zinc-300'}>
                      {msg.senderName}
                    </span>
                    {msg.senderRole === 'teacher' && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-white text-black font-semibold">
                        Öğretmen
                      </span>
                    )}
                    {msg.isQuestion && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-600 text-white font-bold">
                        <HelpCircle className="w-2.5 h-2.5" /> Soru
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-zinc-200 text-xs break-words whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </div>

                {msg.isQuestion && (
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px]">
                    {msg.isAnswered ? (
                      <span className="text-zinc-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-white" /> Cevaplandı
                      </span>
                    ) : (
                      <span className="text-zinc-400 italic">Cevap bekleniyor...</span>
                    )}

                    {isTeacher && !msg.isAnswered && (
                      <button
                        onClick={() => onMarkAnswered(msg.id)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-zinc-200 text-black font-semibold transition-colors"
                      >
                        Cevaplandı Yap
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-950 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isQuestion}
              onChange={(e) => setIsQuestion(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-white focus:ring-0"
            />
            <span className={isQuestion ? 'text-white font-semibold' : 'text-zinc-400'}>
              Bu bir soru (?)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isQuestion ? "Öğretmene sorunuzu yazın..." : "Mesajınızı yazın..."}
            className="flex-1 bg-zinc-900 text-white text-xs px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-white transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-white hover:bg-zinc-200 text-black disabled:opacity-20 disabled:hover:bg-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
