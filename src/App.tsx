/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Calendar, 
  Gamepad2, 
  BookOpen, 
  Trophy, 
  Settings, 
  Sparkles, 
  Heart,
  Brain,
  Mic,
  MicOff,
  Volume2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { generateResponse, generateSpeech, ChildProfile, AIResponse } from './services/geminiService';

type Mode = 'chat' | 'routine' | 'game' | 'story' | 'toys' | 'skills' | 'parent';

// Speech Recognition Type Definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChildProfile>({ level: 1, engagementScore: 0, interests: [] });
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handleSendRef = useRef<any>(null);
  const hasWelcomed = useRef(false);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (hasWelcomed.current) return;
    hasWelcomed.current = true;

    // Welcome message
    const welcome = async () => {
      setIsLoading(true);
      try {
        const response = await generateResponse("Say hello and welcome me to GeniusKid!", 'chat', profile);
        const audioUrl = await generateSpeech(response.spokenText);
        if (audioUrl) {
          playAudio(audioUrl, response.spokenText);
        } else {
          speakFallback(response.spokenText);
        }
      } catch (e) {
        console.error(e);
        setErrorMessage("Failed to connect to AI. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };
    welcome();

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (handleSendRef.current) {
          handleSendRef.current(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error("Speech recognition error", event.error);
          if (event.error === 'not-allowed') {
            setErrorMessage("Microphone access blocked. Please allow mic permissions.");
          } else if (event.error === 'network') {
            setErrorMessage("Network error. Please check your connection.");
          } else {
            setErrorMessage(`Microphone error: ${event.error}`);
          }
        }
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsMicEnabled(false);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setErrorMessage("Voice recognition is not supported in your browser. Try Chrome!");
    }
  }, []);

  const playSFX = (type: 'click' | 'send' | 'receive') => {
    const sounds = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      send: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
      receive: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.3;
    audio.play().catch(e => console.log("SFX play failed", e));
  };

  const speakFallback = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setErrorMessage("Text-to-speech is not supported in your browser.");
      setCurrentSubtitle(text);
      setIsSpeaking(true);
      setTimeout(() => {
        setIsSpeaking(false);
        setCurrentSubtitle(null);
      }, Math.max(3000, text.length * 80));
      return;
    }
    
    window.speechSynthesis.cancel();
    setCurrentSubtitle(text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.2;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSubtitle(null);
    };
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      setIsSpeaking(false);
      setCurrentSubtitle(null);
      setErrorMessage("Failed to play fallback audio.");
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const playAudio = async (base64Data: string, text: string) => {
    try {
      setCurrentSubtitle(text);
      setIsSpeaking(true);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch (e) {
          console.warn("Could not resume audio context", e);
        }
      }
      
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcmData = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }
      const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        setIsSpeaking(false);
        setCurrentSubtitle(null);
        audioContext.close();
      };
      source.start();

      if (audioContext.state === 'suspended') {
        console.warn("AudioContext is suspended (autoplay blocked).");
        setErrorMessage("Audio autoplay blocked by browser. Tap anywhere to enable sound!");
        setTimeout(() => {
          setIsSpeaking(false);
          setCurrentSubtitle(null);
        }, Math.max(3000, text.length * 80));
      }
    } catch (err) {
      console.error("Audio playback error:", err);
      setErrorMessage("Failed to play high-quality audio. Using fallback.");
      speakFallback(text);
    }
  };

  const handleSend = async (text: string = '', overrideMode?: Mode) => {
    if (!text.trim() && !overrideMode) return;
    if (isLoading || isSpeaking) return;
    
    const currentMode = overrideMode || mode;
    setIsLoading(true);
    playSFX('send');

    try {
      const response = await generateResponse(text || `Generate a ${currentMode} content`, currentMode, profile);
      
      // Update profile based on response
      setProfile(prev => {
        const newLevel = Math.max(1, Math.min(10, prev.level + response.difficultyAdjustment));
        const newInterests = response.newInterestDetected && !prev.interests.includes(response.newInterestDetected.toLowerCase())
          ? [...prev.interests, response.newInterestDetected.toLowerCase()]
          : prev.interests;
          
        return {
          level: newLevel,
          engagementScore: prev.engagementScore + response.engagementScore,
          interests: newInterests
        };
      });

      const audioUrl = await generateSpeech(response.spokenText);
      playSFX('receive');

      if (currentMode === 'game' || currentMode === 'skills') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
        });
      }
      
      if (audioUrl) {
        playAudio(audioUrl, response.spokenText);
      } else {
        speakFallback(response.spokenText);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to connect to AI. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    if (!recognitionRef.current) return;

    let timeoutId: any;

    if (isMicEnabled && !isSpeaking && !isLoading && !isListening) {
      timeoutId = setTimeout(() => {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error("Failed to start recognition", e);
        }
      }, 300);
    } else if ((!isMicEnabled || isSpeaking || isLoading) && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.error("Failed to stop recognition", e);
      }
    }

    return () => clearTimeout(timeoutId);
  }, [isMicEnabled, isSpeaking, isLoading, isListening]);

  const toggleListening = () => {
    playSFX('click');
    setIsMicEnabled(prev => !prev);
  };

  const modes = [
    { id: 'chat', label: 'Ask Me', icon: MessageCircle, color: 'bg-indigo-500' },
    { id: 'routine', label: 'My Day', icon: Calendar, color: 'bg-emerald-500' },
    { id: 'game', label: 'Play Game', icon: Gamepad2, color: 'bg-violet-500' },
    { id: 'story', label: 'Story Time', icon: BookOpen, color: 'bg-amber-500' },
    { id: 'toys', label: 'Cool Toys', icon: Sparkles, color: 'bg-rose-500' },
    { id: 'skills', label: 'New Skills', icon: Trophy, color: 'bg-sky-500' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFF] font-sans text-slate-900 flex flex-col overflow-hidden relative">
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 max-w-[90vw] w-max"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playful Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
              rotate: [0, 20, 0],
              scale: [1, 1.3, 1]
            }}
            transition={{
              duration: 6 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.4
            }}
            className="absolute opacity-[0.08]"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              color: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'][i % 5]
            }}
          >
            {i % 3 === 0 ? <Sparkles size={80 + i * 10} /> : i % 3 === 1 ? <Heart size={60 + i * 10} /> : <Brain size={70 + i * 10} />}
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white/40 backdrop-blur-md border-b border-white/20 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 md:gap-4">
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200/50"
          >
            <Brain className="w-6 h-6 md:w-7 md:h-7" />
          </motion.div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight text-slate-900">GeniusKid</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Voice Companion</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 bg-white/60 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl shadow-sm border border-white/40">
            <div className="flex items-center gap-1 md:gap-1.5 text-amber-500">
              <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-bold">Lvl {profile.level}</span>
            </div>
            <div className="w-px h-3 md:h-4 bg-slate-200" />
            <div className="flex items-center gap-1 md:gap-1.5 text-rose-500">
              <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-bold">{profile.engagementScore} XP</span>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ rotate: 90, backgroundColor: 'rgba(255,255,255,0.5)' }}
            className="hidden sm:flex p-2 md:p-3 text-slate-400 rounded-xl transition-all"
          >
            <Settings className="w-5 h-5 md:w-[22px] md:h-[22px]" />
          </motion.button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 relative z-10">
        <div className="flex flex-col items-center gap-8 md:gap-12 w-full max-w-2xl text-center">
          <div className="relative">
            <GeniusKidAvatar isListening={isListening} isSpeaking={isSpeaking} isLoading={isLoading} />
            <AnimatePresence>
              {(isListening || isSpeaking) && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0, 0.1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`absolute inset-0 -m-8 rounded-full border-4 ${isListening ? 'border-rose-400' : 'border-indigo-400'}`}
                />
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {isSpeaking && currentSubtitle && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-6 bg-white text-slate-800 px-6 py-4 rounded-2xl shadow-xl border border-slate-100 w-max max-w-[85vw] sm:max-w-md z-30 text-base sm:text-lg font-medium"
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-l border-t border-slate-100" />
                  {currentSubtitle}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2 md:space-y-4 px-4">
            <motion.h2 
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-800"
            >
              {isListening ? "I'm Listening... 👂" : isSpeaking ? "GeniusKid is talking! 🗣️" : isLoading ? "Thinking... ✨" : isMicEnabled ? "Waiting for you... 😊" : "Want to talk? 😊"}
            </motion.h2>
            <p className="text-slate-500 font-medium text-sm sm:text-base md:text-lg">
              {isListening ? "Tell me anything! I love stories." : isSpeaking ? "Listen closely! I have a secret." : isMicEnabled ? "I'm ready when you are!" : "Tap the big button to start!"}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleListening}
            className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
              isMicEnabled 
                ? 'bg-rose-500 text-white shadow-rose-200 ring-[12px] ring-rose-100' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 ring-[12px] ring-indigo-50'
            }`}
          >
            <AnimatePresence mode="wait">
              {isMicEnabled ? (
                <motion.div key="mic-off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <MicOff className="w-12 h-12 md:w-16 md:h-16" />
                </motion.div>
              ) : (
                <motion.div key="mic-on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Mic className="w-12 h-12 md:w-16 md:h-16" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="mt-8 md:mt-16 flex flex-wrap gap-2 md:gap-4 justify-center max-w-3xl px-2">
          {modes.map((m) => (
            <QuickChip 
              key={m.id} 
              label={`${m.label} ${m.id === 'game' ? '🧩' : m.id === 'story' ? '📖' : '✨'}`} 
              onClick={() => {
                setMode(m.id as Mode);
                handleSend(`Let's do a ${m.label} activity!`, m.id as Mode);
              }} 
            />
          ))}
        </div>
      </main>

      <AnimatePresence>
        {(isListening || isSpeaking) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 pointer-events-none flex items-end justify-center pb-8 md:pb-12"
          >
            <div className="flex items-center gap-2 md:gap-3">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: isListening ? [20, 100, 20] : [30, 150, 30],
                    backgroundColor: isListening ? ['#fb7185', '#f43f5e', '#fb7185'] : ['#818cf8', '#6366f1', '#818cf8']
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 0.6, 
                    delay: i * 0.05,
                    ease: "easeInOut"
                  }}
                  className="w-2 md:w-4 rounded-full shadow-lg"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="p-8 text-center text-slate-300 text-[10px] uppercase tracking-[0.4em] font-bold z-10">
        GeniusKid AI • Spoken Learning • 2026
      </footer>
    </div>
  );
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void; key?: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -3, backgroundColor: '#f8fafc' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="px-4 py-2 md:px-6 md:py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-600 transition-all shadow-md hover:border-indigo-300 hover:text-indigo-600"
    >
      {label}
    </motion.button>
  );
}

function GeniusKidAvatar({ isListening, isSpeaking, isLoading }: { isListening: boolean; isSpeaking: boolean; isLoading: boolean }) {
  return (
    <motion.div 
      animate={{ 
        y: isSpeaking ? [0, -6, 0] : isListening ? [0, -2, 0] : [0, -4, 0],
        scale: isListening ? 1.08 : 1,
        rotate: isListening ? 4 : isSpeaking ? [-2, 2, -2] : isLoading ? [0, 5, -5, 0] : 0
      }}
      transition={{ 
        y: { repeat: Infinity, duration: isSpeaking ? 1.5 : 3, ease: "easeInOut" },
        rotate: { repeat: Infinity, duration: isSpeaking ? 2 : isLoading ? 4 : 3, ease: "easeInOut" },
        scale: { type: "spring", stiffness: 200, damping: 15 }
      }}
      className="relative w-40 h-40 md:w-56 md:h-56"
    >
      {/* Thinking Ring */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, rotate: 0, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 360, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ rotate: { repeat: Infinity, duration: 3, ease: "linear" }, opacity: { duration: 0.3 } }}
            className="absolute inset-0 -m-6 border-4 border-dashed border-amber-400/40 rounded-[3.5rem] z-0"
          />
        )}
      </AnimatePresence>

      {/* Glow Effect */}
      <AnimatePresence>
        {(isListening || isSpeaking || isLoading) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: isLoading ? [1.6, 1.9, 1.6] : isListening ? [1.7, 2.0, 1.7] : isSpeaking ? [1.6, 1.8, 1.6] : 1.5, 
              opacity: isLoading ? [0.2, 0.4, 0.2] : isListening ? [0.3, 0.6, 0.3] : isSpeaking ? [0.2, 0.5, 0.2] : 0.2 
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`absolute inset-0 rounded-full blur-3xl ${isListening ? 'bg-rose-400' : isSpeaking ? 'bg-indigo-400' : 'bg-amber-400'}`}
          />
        )}
      </AnimatePresence>

      {/* Robot Face */}
      <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center border-4 border-white/30 overflow-hidden z-10">
        <div className="flex gap-6 mb-4">
          <motion.div 
            animate={{ 
              height: isListening ? 24 : isSpeaking ? [16, 12, 16] : 16,
              width: isListening ? 24 : 20,
              scaleY: isLoading ? [1, 0.1, 1] : 1,
              rotate: isLoading ? 360 : 0,
              backgroundColor: isLoading ? '#fbbf24' : '#ffffff'
            }}
            transition={{ 
              height: { repeat: Infinity, duration: isSpeaking ? 0.8 : 3, ease: "easeInOut" },
              rotate: { repeat: Infinity, duration: 1, ease: "linear" },
              backgroundColor: { duration: 0.3 },
              width: { type: "spring", stiffness: 300, damping: 20 }
            }}
            className="bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)]" 
          />
          <motion.div 
            animate={{ 
              height: isListening ? 24 : isSpeaking ? [16, 12, 16] : 16,
              width: isListening ? 24 : 20,
              scaleY: isLoading ? [1, 0.1, 1] : 1,
              rotate: isLoading ? -360 : 0,
              backgroundColor: isLoading ? '#fbbf24' : '#ffffff'
            }}
            transition={{ 
              height: { repeat: Infinity, duration: isSpeaking ? 0.8 : 3, ease: "easeInOut", delay: 0.1 },
              rotate: { repeat: Infinity, duration: 1, ease: "linear" },
              backgroundColor: { duration: 0.3 },
              width: { type: "spring", stiffness: 300, damping: 20 }
            }}
            className="bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)]" 
          />
        </div>
        <motion.div 
          animate={{ 
            width: isSpeaking ? [20, 45, 25, 35, 20] : isListening ? 16 : isLoading ? [15, 25, 15] : 24,
            height: isSpeaking ? [8, 24, 12, 20, 8] : isListening ? 16 : isLoading ? 12 : 8,
            borderRadius: isSpeaking ? ["12px", "24px", "16px", "20px", "12px"] : isListening ? "50%" : "20px",
            opacity: isLoading ? [0.4, 1, 0.4] : 1
          }}
          transition={{ 
            width: { repeat: Infinity, duration: isSpeaking ? 0.6 : 1, ease: "easeInOut" },
            height: { repeat: Infinity, duration: isSpeaking ? 0.6 : 1, ease: "easeInOut" },
            borderRadius: { repeat: Infinity, duration: isSpeaking ? 0.6 : 1, ease: "easeInOut" },
            opacity: { repeat: Infinity, duration: 1 }
          }}
          className="bg-white/40" 
        />
      </div>

      {/* Antenna */}
      <motion.div 
        animate={{ 
          rotate: isListening ? [15, 25, 15] : isLoading ? [0, 15, -15, 0] : isSpeaking ? [-5, 5, -5] : 0,
          y: isLoading ? [0, -5, 0] : 0
        }}
        transition={{ repeat: Infinity, duration: isListening ? 0.5 : isSpeaking ? 2 : 0.4, ease: "easeInOut" }}
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-8 bg-indigo-700 rounded-full z-20 origin-bottom"
      >
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full transition-colors duration-300 ${isListening ? 'bg-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.9)] animate-ping' : isLoading ? 'bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.9)]' : 'bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]'}`} />
      </motion.div>
    </motion.div>
  );
}
