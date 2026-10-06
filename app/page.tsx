"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Play, Square, Send, X, Maximize2, Minimize2, ArrowLeftRight, Volume2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

const SUPABASE_PROJECT_ID = "ezvrxsphaexdbpjgpaab"; 
const STORAGE_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/vivekananda-images`;

const VIVEKANANDA_IMAGES = [
  `${STORAGE_BASE_URL}/1.jpg`,
  `${STORAGE_BASE_URL}/2.jpg`,
  `${STORAGE_BASE_URL}/3.jpg`,
  `${STORAGE_BASE_URL}/4.jpg`,
  `${STORAGE_BASE_URL}/5.jpg`
];

type ChatMessage = { role: "user" | "ai"; content: string };
type ChatMode = "closed" | "small" | "half" | "full";

export default function Home() {
  const [userStruggle, setUserStruggle] = useState("");
  const [language, setLanguage] = useState("English");
  const [isGeneratingReel, setIsGeneratingReel] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState("");
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  
  const [chatMode, setChatMode] = useState<ChatMode>("closed");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [forceMaleVoice, setForceMaleVoice] = useState(true);

  const bgMusicRef = useRef<HTMLAudioElement>(null);
  const voicePlayerRef = useRef<HTMLAudioElement>(null); 
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    VIVEKANANDA_IMAGES.forEach(src => { const img = new Image(); img.src = src; });
    window.speechSynthesis.getVoices();
    
    const fetchChat = async () => {
      try {
        const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50);
        if (error) throw error;
        if (data && data.length > 0) {
          setChatHistory(data.map(msg => ({ role: msg.role as "user" | "ai", content: msg.content })));
          return;
        }
      } catch (err) {
        console.log("Supabase unavailable. Falling back to local storage.");
      }
      
      const savedChat = localStorage.getItem("vivekananda_chat");
      if (savedChat) {
        setChatHistory(JSON.parse(savedChat));
      } else {
        setChatHistory([{ role: "ai", content: "Arise, awake! What burdens your mind today, my friend?" }]);
      }
    };
    
    fetchChat();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => setCurrentImgIndex(prev => (prev + 1) % VIVEKANANDA_IMAGES.length), 5000); 
    } else {
      setCurrentImgIndex(0); 
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    if (chatHistory.length > 0) localStorage.setItem("vivekananda_chat", JSON.stringify(chatHistory));
  }, [chatHistory, chatMode]);

  const handleGenerateReel = async () => {
    if (!userStruggle) return alert("Please share what is on your mind.");
    
    setIsGeneratingReel(true);
    setGeneratedResponse("");
    setVoiceAudioUrl(null);
    
    if (voicePlayerRef.current) voicePlayerRef.current.pause();
    if (bgMusicRef.current) bgMusicRef.current.pause();
    setIsPlaying(false);

    try {
      const response = await fetch("/api/generate-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChat: false, userStruggle, language }),
      });
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Server connection failed.`);
      }
      
      if (data.response) setGeneratedResponse(data.response);
      if (data.audioBase64) setVoiceAudioUrl(`data:audio/mpeg;base64,${data.audioBase64}`);
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsGeneratingReel(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMessage: ChatMessage = { role: "user", content: chatInput };
    const newHistory = [...chatHistory, newMessage];
    
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatting(true);

    try { await supabase.from('chat_messages').insert([{ role: 'user', content: newMessage.content }]); } catch (e) {}

    try {
      const response = await fetch("/api/generate-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChat: true, message: newMessage.content, history: newHistory }),
      });
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Server connection failed.`);
      }
      
      const aiReply: ChatMessage = { role: "ai", content: data.reply || "No reply data found." };
      setChatHistory(prev => [...prev, aiReply]);
      
      try { await supabase.from('chat_messages').insert([{ role: 'ai', content: aiReply.content }]); } catch (e) {}
      
    } catch (error: any) {
      setChatHistory(prev => [...prev, { role: "ai", content: `ERROR: ${error.message}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleClearHistory = async () => {
    try { await supabase.from('chat_messages').delete().neq('id', 0); } catch (e) {}
    localStorage.removeItem("vivekananda_chat");
    setChatHistory([{ role: "ai", content: "Arise, awake! What burdens your mind today, my friend?" }]);
  };

  const playBrowserMaleVoice = () => {
    window.speechSynthesis.cancel(); 
    
    const sentences = generatedResponse.split(/[.।!?]+/).filter(sentence => sentence.trim().length > 0);
    
    // 1. Establish the correct language code so the browser knows what alphabet it's reading
    let targetLang = "en-IN";
    if (language === "Hindi") targetLang = "hi-IN";
    else if (language === "Tamil") targetLang = "ta-IN";
    else if (language === "Bengali") targetLang = "bn-IN";

    const voices = window.speechSynthesis.getVoices();
    
    // 2. ONLY fetch voices that match the language! An English voice cannot read Hindi.
    let langVoices = voices.filter(v => v.lang.toLowerCase().includes(targetLang.split('-')[0]));
    
    // 3. Try to find a male voice within that specific language list
    let selectedVoice = langVoices.find(v => 
      v.name.includes("Rishi") || v.name.includes("Male")
    );

    // 4. If no male voice exists for Hindi, just pick ANY Hindi voice so it actually speaks!
    if (!selectedVoice && langVoices.length > 0) {
      selectedVoice = langVoices[0];
    }

    sentences.forEach((sentence, index) => {
      const utterance = new SpeechSynthesisUtterance(sentence.trim() + "."); 
      utterance.pitch = 0.1; 
      utterance.rate = 0.75; 
      utterance.lang = targetLang;
      if (selectedVoice) utterance.voice = selectedVoice;

      if (index === sentences.length - 1) {
        utterance.onend = () => {
          setIsPlaying(false);
          if (bgMusicRef.current) bgMusicRef.current.pause();
        };
      }
      
      window.speechSynthesis.speak(utterance);
    });
  };

  const togglePlayAudio = () => {
    if (isPlaying) {
      if (voicePlayerRef.current) voicePlayerRef.current.pause();
      if (bgMusicRef.current) bgMusicRef.current.pause();
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (bgMusicRef.current) {
      bgMusicRef.current.volume = 0.15; 
      bgMusicRef.current.play().catch(() => {});
    }

    if (voiceAudioUrl && voicePlayerRef.current && !forceMaleVoice) {
      voicePlayerRef.current.play().catch(() => {});
      voicePlayerRef.current.onended = () => {
        setIsPlaying(false);
        if (bgMusicRef.current) bgMusicRef.current.pause();
      };
    } else {
      playBrowserMaleVoice();
    }
    
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 font-sans text-slate-900 overflow-x-hidden relative">
      <audio ref={bgMusicRef} src="https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" loop />
      {voiceAudioUrl && <audio ref={voicePlayerRef} src={voiceAudioUrl} />}

      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-orange-500" />
            Interactive AI Vivekananda
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Generate a 15-60 second wisdom reel, or click his icon to chat directly.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center justify-center pt-8">
          
          <div className="w-full lg:w-1/3 bg-white shadow-xl rounded-3xl p-6 border border-slate-100">
            <h2 className="text-xl font-bold mb-6">Create a Reel</h2>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">What is on your mind?</label>
                <textarea 
                  placeholder="e.g., I fear failure..."
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium bg-white resize-none h-32"
                  value={userStruggle}
                  onChange={(e) => setUserStruggle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Language</label>
                <select 
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium bg-white mb-3"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Tamil">Tamil</option>
                </select>
                
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 bg-slate-100 p-3 rounded-xl border border-slate-200 hover:bg-slate-200 transition">
                  <input 
                    type="checkbox" 
                    checked={forceMaleVoice}
                    onChange={(e) => setForceMaleVoice(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <Volume2 className="w-4 h-4 text-orange-500" />
                  Force Deep Male Voice Override
                </label>
              </div>

              <button 
                onClick={handleGenerateReel} 
                disabled={isGeneratingReel}
                className="w-full flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl py-4 font-bold text-lg shadow-lg transition-colors"
              >
                {isGeneratingReel ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Rendering Long Video...</>
                ) : (
                  <><Play className="w-5 h-5 mr-2" /> Generate Video</>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className={`relative w-[320px] h-[568px] bg-black rounded-3xl overflow-hidden shadow-2xl border-[6px] border-slate-800 transition-all duration-300 ${isPlaying ? 'shadow-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.4)]' : ''}`}>
              
              {isGeneratingReel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-50">
                  <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                  <p className="text-white font-medium animate-pulse">Writing 15-60s Script...</p>
                </div>
              )}

              {!isGeneratingReel && generatedResponse && !isPlaying && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                   <button 
                      onClick={togglePlayAudio}
                      className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-6 shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-transform hover:scale-110 flex flex-col items-center"
                   >
                     <Play className="w-12 h-12 ml-2" />
                   </button>
                   <p className="text-white font-bold mt-6 text-lg tracking-wider uppercase">Video Ready</p>
                </div>
              )}

              {VIVEKANANDA_IMAGES.map((img, index) => {
                const isActive = index === currentImgIndex && isPlaying;
                const isPausedThumbnail = index === 0 && generatedResponse && !isPlaying;
                return (
                  <img 
                    key={img} src={img} alt={`Swami ${index}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      transformOrigin: ["center", "top left", "bottom right", "top right", "bottom left"][index % 5],
                      transition: "opacity 1000ms ease-in-out, transform 5500ms linear",
                      opacity: isActive ? 1 : isPausedThumbnail ? 0.5 : 0,
                      transform: isActive || isPausedThumbnail ? (index % 2 === 0 ? "scale(1.15)" : "scale(1)") : (index % 2 === 0 ? "scale(1)" : "scale(1.15)"),
                      zIndex: isActive ? 20 : isPausedThumbnail ? 10 : 0
                    }}
                  />
                );
              })}

              {isPlaying && (
                <>
                  <div className="absolute inset-x-0 bottom-0 h-[85%] bg-gradient-to-t from-black via-black/80 to-transparent z-30" />
                  <div className="absolute inset-0 z-40 flex flex-col justify-end p-6 pb-8">
                    <div className="h-64 overflow-y-auto no-scrollbar text-white drop-shadow-md text-[15px] font-medium leading-relaxed text-center">
                      "{generatedResponse}"
                    </div>
                  </div>
                </>
              )}

              {!isGeneratingReel && !generatedResponse && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-900 z-10">
                  <Play className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium">Generate a reel to begin.</p>
                </div>
              )}
            </div>

            {isPlaying && (
               <button onClick={togglePlayAudio} className="mt-6 flex items-center px-8 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg">
                 <Square className="w-5 h-5 mr-2" /> Stop Video
               </button>
            )}
          </div>
        </div>
      </div>

      {chatMode === "closed" ? (
        <button 
          onClick={() => setChatMode("small")}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-white p-2 pr-5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform group border border-slate-100"
        >
          <img src={VIVEKANANDA_IMAGES[0]} alt="Swami AI" className="w-14 h-14 rounded-full object-cover border-2 border-orange-500" />
          <div className="text-left hidden md:block">
            <p className="font-bold text-slate-800 text-sm">Swami Vivekananda</p>
            <p className="text-xs text-orange-500 font-medium">Ask for guidance...</p>
          </div>
        </button>
      ) : (
        <div className={`fixed z-50 bg-white shadow-2xl transition-all duration-300 flex flex-col overflow-hidden border border-slate-200
          ${chatMode === 'small' ? 'bottom-8 right-8 w-[380px] h-[550px] rounded-3xl' : ''}
          ${chatMode === 'half' ? 'top-0 right-0 w-[450px] h-full rounded-l-3xl' : ''}
          ${chatMode === 'full' ? 'top-0 left-0 w-full h-full rounded-none' : ''}
        `}>
          <div className="bg-orange-500 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={VIVEKANANDA_IMAGES[0]} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white/50" />
              <div>
                <h3 className="font-bold text-md leading-tight">AI Vivekananda</h3>
                <button onClick={handleClearHistory} className="text-orange-100 text-[10px] uppercase tracking-wider hover:text-white underline">Clear Chat History</button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setChatMode("small")} className="p-2 hover:bg-white/20 rounded-lg"><Minimize2 className="w-4 h-4" /></button>
              <button onClick={() => setChatMode("half")} className="p-2 hover:bg-white/20 rounded-lg"><ArrowLeftRight className="w-4 h-4" /></button>
              <button onClick={() => setChatMode("full")} className="p-2 hover:bg-white/20 rounded-lg"><Maximize2 className="w-4 h-4" /></button>
              <button onClick={() => setChatMode("closed")} className="p-2 hover:bg-red-500 rounded-lg ml-2"><X className="w-5 h-5" /></button>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4" ref={chatScrollRef}>
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 text-slate-500 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <input 
              type="text" 
              placeholder="Type your question..." 
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatting}
            />
            <button 
              type="submit" 
              disabled={isChatting || !chatInput.trim()}
              className="bg-slate-900 text-white px-5 rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}