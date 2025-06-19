import { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeOff, BookOpen, MessageCircle, Send, Trash2, PlusCircle, MoreHorizontal, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { voiceService } from '@/services/voiceService';
import { geminiService, VictorAIResponse } from '@/services/geminiService';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import UserSettings from '@/components/UserSettings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Message {
  id: string;
  type: 'user' | 'victor';
  content: string;
  timestamp: Date;
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  vocabularyTip?: {
    word: string;
    definition: string;
    examples: string[];
  };
  pronunciationTip?: {
    word: string;
    phonetic: string;
    tip: string;
  };
  followUpQuestion?: string;
}

// Add hardcoded russianVocabulary from UserSettings
const russianVocabulary = [
];

// Chat data model
interface Chat {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { settings, getApiKey } = useUserSettings();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [aiVocabulary, setAiVocabulary] = useState<Array<{
    word: string;
    definition: string;
    examples: string[];
    phonetic?: string;
    romanized?: string;
    translation?: string;
    exampleDetails?: Array<{ russian: string; phonetic: string; translation: string }>;
  }>>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<'chat' | 'vocab'>('chat');
  const [selection, setSelection] = useState<{ word: string, rect: DOMRect | null } | null>(null);
  const [addingVocab, setAddingVocab] = useState(false);
  // Chat history state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatNameInput, setChatNameInput] = useState('');
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [showChatPopover, setShowChatPopover] = useState(false);
  const chatPopoverRef = useRef<HTMLDivElement>(null);

  // Check for API key from user settings
  useEffect(() => {
    const apiKey = getApiKey();
    if (apiKey) {
      geminiService.initialize(apiKey);
      setHasApiKey(true);
    } else {
      setHasApiKey(false);
    }
  }, [settings?.gemini_api_key, getApiKey]);

  // Load chats from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('victorai_chats');
    if (stored) {
      const parsed: Chat[] = JSON.parse(stored);
      setChats(parsed);
      if (parsed.length > 0) setActiveChatId(parsed[0].id);
    } else {
      // If no chats, create a default chat
      const defaultChat: Chat = {
        id: 'chat-' + Date.now(),
        name: 'New Chat',
        messages: [
          {
            id: '1',
            type: 'victor',
            content: "Привет! I'm VictorAI, your personal Russian tutor. I can hear you speak and talk back to you! I'll help you improve your Russian through natural conversation. Press the microphone button and start talking, or type your message. What Russian words would you like to learn today?",
            timestamp: new Date(),
            followUpQuestion: "Tell me what you'd like to learn in Russian - greetings, numbers, or everyday phrases!"
          }
        ],
        createdAt: Date.now(),
      };
      setChats([defaultChat]);
      setActiveChatId(defaultChat.id);
    }
  }, []);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('victorai_chats', JSON.stringify(chats));
  }, [chats]);

  // Get active chat and its messages
  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat ? activeChat.messages : [];
  const setMessages = (msgs: Message[]) => {
    setChats(prev => prev.map(chat =>
      chat.id === activeChatId ? { ...chat, messages: msgs } : chat
    ));
  };

  // Create a new chat
  const handleNewChat = () => {
    const newId = 'chat-' + Date.now();
    const newChat: Chat = {
      id: newId,
      name: `New Chat ${chats.length + 1}`,
      messages: [
        {
          id: '1',
          type: 'victor',
          content: "Привет! I'm VictorAI, your personal Russian tutor. I can hear you speak and talk back to you! I'll help you improve your Russian through natural conversation. Press the microphone button and start talking, or type your message. What Russian words would you like to learn today?",
          timestamp: new Date(),
          followUpQuestion: "Tell me what you'd like to learn in Russian - greetings, numbers, or everyday phrases!"
        }
      ],
      createdAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    setChatNameInput('');
  };

  // Rename chat
  const handleRenameChat = (chatId: string, newName: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, name: newName } : chat
    ));
    setRenamingChatId(null);
  };

  // Delete chat (optional, not in original request)
  const handleDeleteChat = (chatId: string) => {
    let newChats = chats.filter(chat => chat.id !== chatId);
    if (newChats.length === 0) {
      // Always keep at least one chat
      handleNewChat();
      newChats = chats;
    }
    setChats(newChats);
    if (activeChatId === chatId && newChats.length > 0) {
      setActiveChatId(newChats[0].id);
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleApiKeySet = (apiKey: string) => {
    if (apiKey) {
      geminiService.initialize(apiKey);
      setHasApiKey(true);
    } else {
      setHasApiKey(false);
    }
  };

  const processMessageWithAI = async (userMessage: string, baseMessages: Message[]) => {
    try {
      const conversationHistory = baseMessages
        .slice(-6)
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');
      
      const aiResponse = await geminiService.generateVictorAIResponse(userMessage, [conversationHistory]);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'victor',
        content: aiResponse.response,
        timestamp: new Date(),
        corrections: aiResponse.corrections,
        vocabularyTip: aiResponse.vocabularyTip,
        pronunciationTip: aiResponse.pronunciationTip,
        followUpQuestion: aiResponse.followUpQuestion
      };

      setMessages([...baseMessages, aiMessage]);

      // Use auto-speak setting from user preferences
      if (settings?.auto_speak) {
        setIsSpeaking(true);
        voiceService.speak(aiResponse.response, () => {
          setIsSpeaking(false);
        });
      }
    } catch (error) {
      console.error('AI processing error:', error);
      toast({
        title: "AI Error",
        description: "Failed to get AI response. Please check your API key in settings.",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim() || !hasApiKey) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    await processMessageWithAI(messageText, newMessages);
    setIsLoading(false);
  };

  const handleVoiceInput = () => {
    if (!hasApiKey) {
      toast({
        title: "API Key Required",
        description: "Please set your Gemini API key in settings first",
      });
      return;
    }

    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    voiceService.startListening(
      (text) => {
        setInputMessage(text);
        setIsListening(false);
        handleSendMessage(text);
      },
      () => {
        setIsListening(false);
      },
      (error) => {
        setIsListening(false);
        toast({
          title: "Voice Input Error",
          description: error,
          variant: "destructive"
        });
      }
    );
  };

  const handleTextToSpeech = (text: string) => {
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      voiceService.speak(text, () => {
        setIsSpeaking(false);
      });
    }
  };

  // Helper function to detect if text contains Russian characters
  const containsRussian = (text: string) => {
    return /[а-яё]/i.test(text);
  };

  // Helper function to extract only Russian sentences from mixed text
  const extractRussianSentences = (text: string) => {
    // Split by common punctuation and filter for sentences containing Russian
    const sentences = text.split(/[.!?;]/).filter(sentence => 
      sentence.trim() && containsRussian(sentence.trim())
    );
    return sentences.join('. ').trim();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Remove word from aiVocabulary
  const handleRemoveVocab = (word: string) => {
    setAiVocabulary(prev => prev.filter(item => item.word.toLowerCase() !== word.toLowerCase()));
  };

  // Helper function to guess if a word is Russian
  const isRussianWord = (word: string) => /[а-яА-ЯёЁ]/.test(word);
  // Helper function for a simple phonetic placeholder (could be improved with a real transliterator)
  const getPhonetic = (word: string) => isRussianWord(word) ? '(phonetic unavailable)' : '';

  // Helper function for romanization (very basic, can be improved)
  const romanizeRussian = (word: string) => {
    // Simple mapping for demonstration; use a library for real transliteration
    const map: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
      'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
      'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ь': '', 'ъ': ''
    };
    return word.split('').map(char => {
      const lower = char.toLowerCase();
      const isUpper = char !== lower;
      const rom = map[lower] || char;
      return isUpper ? rom.charAt(0).toUpperCase() + rom.slice(1) : rom;
    }).join('');
  };

  // Listen for text selection in chat
  useEffect(() => {
    if (selectedTab !== 'chat') return;
    const handleMouseUp = (e: MouseEvent) => {
      const sel = window.getSelection();
      const selectedText = sel && sel.toString().trim();
      // Allow selection of multiple words (at least one non-empty, max 5 words for sanity)
      if (selectedText && selectedText.split(/\s+/).length <= 5 && selectedText.length > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({ word: selectedText, rect });
      } else {
        setSelection(null);
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [selectedTab]);

  // Add word/phrase to aiVocabulary (manual)
  const handleAddVocab = async (phrase: string) => {
    if (!phrase.trim()) return;
    const exists = russianVocabulary.some(item => item.word.toLowerCase() === phrase.toLowerCase()) ||
      aiVocabulary.some(item => item.word.toLowerCase() === phrase.toLowerCase());
    if (exists) return;
    setAddingVocab(true);
    let definition = isRussianWord(phrase) ? 'Russian phrase (added manually)' : 'English phrase (added manually)';
    let phonetic = '';
    let examples: string[] = [];
    let romanized = '';
    let translation = '';
    let exampleDetails: Array<{ russian: string; phonetic: string; translation: string }> = [];
    try {
      // Fetch data for the whole phrase
      const data = await geminiService.fetchWordData(phrase);
      phonetic = data.phonetic;
      examples = data.examples;
      translation = data.translation;
      romanized = isRussianWord(phrase) ? romanizeRussian(phrase) : '';
      // For each example, fetch pronunciation and translation
      exampleDetails = await Promise.all(
        (examples || []).map(async (ex) => {
          try {
            const exData = await geminiService.fetchWordData(ex);
            return {
              russian: ex,
              phonetic: exData.phonetic || '',
              translation: exData.translation || '',
            };
          } catch {
            return { russian: ex, phonetic: '', translation: '' };
          }
        })
      );
    } catch (e) {}
    setAiVocabulary(prev => [
      ...prev,
      { word: phrase, definition, phonetic, examples, romanized, translation, exampleDetails }
    ]);
    setSelection(null);
    setAddingVocab(false);
  };

  // On mount, load aiVocabulary from localStorage
  useEffect(() => {
    const storedVocab = localStorage.getItem('victorai_vocab');
    if (storedVocab) {
      setAiVocabulary(JSON.parse(storedVocab));
    }
  }, []);

  // Whenever aiVocabulary changes, save it to localStorage
  useEffect(() => {
    localStorage.setItem('victorai_vocab', JSON.stringify(aiVocabulary));
  }, [aiVocabulary]);

  // Redirect to auth if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-blue-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Floating Chat History Button */}
      <button
        className="fixed top-6 left-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        onClick={() => setShowChatPopover(true)}
        title="Show Chats"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}
      >
        <MoreHorizontal className="w-6 h-6 text-blue-600 dark:text-blue-300" />
      </button>
      {/* Floating Chat History Popover */}
      {showChatPopover && (
        <div
          ref={chatPopoverRef}
          className="fixed top-20 left-6 z-50 w-80 max-w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col animate-fade-in"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Chats</h2>
            <Button size="icon" variant="ghost" onClick={() => setShowChatPopover(false)}><X className="w-5 h-5" /></Button>
          </div>
          <Button size="sm" className="mb-3 w-full" onClick={handleNewChat}>
            + New Chat
          </Button>
          <div className="flex-1 overflow-y-auto max-h-96">
            {chats.map(chat => (
              <div key={chat.id} className={`mb-2 p-2 rounded-lg cursor-pointer flex items-center justify-between ${chat.id === activeChatId ? 'bg-blue-100 dark:bg-blue-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => { setActiveChatId(chat.id); setShowChatPopover(false); }}>
                {renamingChatId === chat.id ? (
                  <form onSubmit={e => { e.preventDefault(); handleRenameChat(chat.id, chatNameInput); }} className="flex-1 flex gap-2">
                    <Input value={chatNameInput} onChange={e => setChatNameInput(e.target.value)} size={8} autoFocus />
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                ) : (
                  <>
                    <span className="truncate flex-1" title={chat.name}>{chat.name}</span>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setRenamingChatId(chat.id); setChatNameInput(chat.name); }}>Rename</Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDeleteChat(chat.id); }} title="Delete Chat" className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Floating Add to Vocabulary button (top-level, not inside chat container) */}
      {selectedTab === 'chat' && selection && selection.rect && (
        <button
          style={{
            position: 'fixed',
            top: selection.rect.bottom + 6,
            left: selection.rect.left,
            zIndex: 100,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '4px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          onClick={() => { handleAddVocab(selection.word); setSelection(null); }}
        >
          <PlusCircle style={{ width: 16, height: 16, color: '#16a34a' }} />
          <span style={{ fontSize: 14, color: 'black' }}>Add "{selection.word}" to Vocabulary</span>
        </button>
      )}
      {/* Main Content (centered, no sidebar) */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex justify-center">
          <Tabs value={selectedTab} onValueChange={v => setSelectedTab(v as 'chat' | 'vocab')}>
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="vocab">Vocabulary</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Chat Section */}
          {selectedTab === 'chat' && (
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-blue-600 rounded-full flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent">
                    VictorAI
                  </h1>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300">Your Voice-Enabled AI Russian Language Tutor</p>
                
                <div className="flex items-center justify-center gap-4 mt-4">
                  <UserSettings onApiKeySet={handleApiKeySet} hasApiKey={hasApiKey} aiVocabulary={aiVocabulary} />
                </div>
              </div>

              {/* Chat Container */}
              {hasApiKey && (
                <Card className="h-[600px] flex flex-col shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  {/* Messages Area */}
                  <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
                    <div className="space-y-6">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                            {/* Avatar */}
                            <div className={`flex items-center gap-2 mb-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                message.type === 'user' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gradient-to-r from-red-500 to-blue-500 text-white'
                              }`}>
                                {message.type === 'user' ? 'U' : 'В'}
                              </div>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {message.type === 'user' ? 'You' : 'VictorAI'}
                              </span>
                            </div>

                            {/* Message Bubble */}
                            <div className={`rounded-2xl p-4 ${
                              message.type === 'user'
                                ? 'bg-blue-600 text-white ml-8'
                                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 mr-8 shadow-sm'
                            }`}>
                              <div className="flex items-start justify-between">
                                <p className="leading-relaxed flex-1 dark:text-gray-100">{message.content}</p>
                                {message.type === 'victor' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTextToSpeech(message.content)}
                                    className="h-8 w-8 p-0 ml-2 shrink-0"
                                  >
                                    {isSpeaking ? <VolumeOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                  </Button>
                                )}
                              </div>
                              
                              {/* Corrections - Only show if they contain Russian text */}
                              {message.corrections && message.corrections.some(correction => 
                                containsRussian(correction.original) || containsRussian(correction.corrected)
                              ) && (
                                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                                      Russian Grammar Correction
                                    </Badge>
                                  </div>
                                  {message.corrections
                                    .filter(correction => containsRussian(correction.original) || containsRussian(correction.corrected))
                                    .map((correction, index) => (
                                    <div key={index} className="text-sm">
                                      <span className="text-red-600 line-through">{correction.original}</span>
                                      {' → '}
                                      <span className="text-green-600 font-medium">{correction.corrected}</span>
                                      <p className="text-gray-600 dark:text-gray-300 mt-1">{correction.explanation}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Vocabulary Tip */}
                              {message.vocabularyTip && (
                                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                                      Russian Vocabulary
                                    </Badge>
                                  </div>
                                  <div className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <strong>{message.vocabularyTip.word}:</strong>
                                      {containsRussian(message.vocabularyTip.word) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleTextToSpeech(message.vocabularyTip!.word)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Volume2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                      <span>{message.vocabularyTip.definition}</span>
                                    </div>
                                    <div className="mt-2">
                                      <p className="font-medium text-gray-700 dark:text-gray-300">Examples:</p>
                                      {message.vocabularyTip.examples.map((example, index) => {
                                        const russianText = extractRussianSentences(example);
                                        return (
                                          <div key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 ml-2">
                                            <span>•</span>
                                            <span className="flex-1">{example}</span>
                                            {russianText && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleTextToSpeech(russianText)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Volume2 className="w-3 h-3" />
                                              </Button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Follow-up Question */}
                              {message.followUpQuestion && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-1">
                                    <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Follow-up Question:</span>
                                  </div>
                                  <p className="text-sm text-blue-800 dark:text-blue-200">{message.followUpQuestion}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Loading indicator */}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 mr-8 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span className="text-sm text-gray-500 ml-2">VictorAI is thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input Area */}
                  <div className="border-t border-gray-200 dark:border-gray-600 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Input
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder={isListening ? "Listening..." : "Type your message or click the mic to speak Russian..."}
                          className="min-h-[44px] resize-none border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          disabled={isLoading || isListening}
                        />
                      </div>
                      <Button
                        variant={isListening ? "destructive" : "ghost"}
                        size="sm"
                        onClick={handleVoiceInput}
                        className="h-11 w-11 p-0"
                        disabled={isLoading}
                      >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </Button>
                      <Button
                        onClick={() => handleSendMessage()}
                        disabled={!inputMessage.trim() || isLoading || isListening}
                        className="h-11 px-6 bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {!hasApiKey && (
                <Card className="p-8 text-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to VictorAI!</h2>
                    <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                      To start learning Russian with AI-powered conversations, please set up your Gemini API key in the settings above.
                    </p>
                  </div>
                </Card>
              )}

              {/* Features */}
              <div className="mt-5 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0">
                  {hasApiKey ? '🎤 Voice Input • 🔊 Voice Output • 🇷🇺 AI-Powered Russian Learning' : 'Set up your API key in settings to start learning Russian'}
                </p>
                
              </div>
            </div>
          )}
          {/* Vocabulary Section */}
          {selectedTab === 'vocab' && (
            <div className="w-full lg:w-96 max-w-full mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 h-full flex flex-col">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-6 h-6" /> Vocabulary
                </h2>
                <div className="overflow-y-auto flex-1">
                  {/* Hardcoded vocabulary (no remove button) */}
                  {russianVocabulary.map((item, index) => (
                    <div key={index} className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-lg">{item.word}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTextToSpeech(item.word)}
                          className="h-6 w-6 p-0"
                        >
                          <Volume2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{item.translation}</p>
                      {item.phonetic && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.phonetic}</p>
                      )}
                    </div>
                  ))}
                  {/* AI vocabulary (removable) */}
                  {aiVocabulary.map((item, index) => (
                    <div key={index} className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-lg">{item.word}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTextToSpeech(item.word)}
                          className="h-6 w-6 p-0"
                        >
                          <Volume2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveVocab(item.word)}
                          className="h-6 w-6 p-0 text-red-500"
                          title="Remove from Vocabulary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{item.definition}</p>
                      {item.phonetic && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.phonetic}</p>
                      )}
                      {item.romanized && (
                        <p className="text-xs text-green-700 dark:text-green-300">{item.romanized}</p>
                      )}
                      {item.examples && item.examples.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Examples:</p>
                          {(item.exampleDetails && item.exampleDetails.length > 0
                            ? item.exampleDetails
                            : item.examples.map(ex => ({ russian: ex, phonetic: '', translation: '' }))
                          ).map((ex, exampleIndex) => {
                            // Generate romanized version for the example sentence
                            const romanizedExample = isRussianWord(ex.russian) ? romanizeRussian(ex.russian) : '';
                            return (
                              <div key={exampleIndex} className="flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <span style={{ lineHeight: 1.2, marginTop: '2px' }}>•</span>
                                <span className="flex-1">
                                  {ex.russian}
                                  {(romanizedExample || ex.translation) && (
                                    <span> 
                                      
                                    </span>
                                  )}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTextToSpeech(ex.russian)}
                                  className="h-5 w-5 p-0"
                                  title="Listen to example"
                                >
                                  <Volume2 className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
