import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, LogOut, User, Moon, Sun, Volume2, Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useToast } from '@/hooks/use-toast';

interface UserSettingsProps {
  onApiKeySet: (apiKey: string) => void;
  hasApiKey: boolean;
  aiVocabulary?: Array<{
    word: string;
    definition: string;
    examples: string[];
  }>;
}

const russianVocabulary = [
  { word: 'Привет', translation: 'Hello', phonetic: '/prʲɪˈvʲet/' },
  { word: 'Спасибо', translation: 'Thank you', phonetic: '/spɐˈsʲibə/' },
  { word: 'Пожалуйста', translation: 'Please/You\'re welcome', phonetic: '/pəˈʐaləstə/' },
  { word: 'Извините', translation: 'Excuse me/Sorry', phonetic: '/ɪzˈvʲinʲɪtʲe/' },
  { word: 'До свидания', translation: 'Goodbye', phonetic: '/də svʲɪˈdanʲɪjə/' },
  { word: 'Как дела?', translation: 'How are you?', phonetic: '/kak dʲɪˈla/' },
  { word: 'Меня зовут', translation: 'My name is', phonetic: '/mʲɪˈnʲa zɐˈvut/' },
  { word: 'Я не понимаю', translation: 'I don\'t understand', phonetic: '/ja nʲe pənʲɪˈmaju/' },
  { word: 'Говорите медленнее', translation: 'Speak slower', phonetic: '/gəvɐˈrʲitʲe ˈmʲedlʲɪnʲɪje/' },
  { word: 'Где туалет?', translation: 'Where is the bathroom?', phonetic: '/gdʲe tuɐˈlʲet/' },
  { word: 'Сколько это стоит?', translation: 'How much does this cost?', phonetic: '/ˈskolʲkə ˈetə ˈstoɪt/' },
  { word: 'Я изучаю русский', translation: 'I am learning Russian', phonetic: '/ja ɪˈzutʂaju ˈruskʲɪj/' },
  { word: 'Очень хорошо', translation: 'Very good', phonetic: '/ˈotʂɪnʲ xɐˈroʂə/' },
  { word: 'Да', translation: 'Yes', phonetic: '/da/' },
  { word: 'Нет', translation: 'No', phonetic: '/nʲet/' },
  // Numbers
  { word: 'один', translation: 'one', phonetic: '/ɐˈdʲin/' },
  { word: 'два', translation: 'two', phonetic: '/dva/' },
  { word: 'три', translation: 'three', phonetic: '/trʲi/' },
  { word: 'четыре', translation: 'four', phonetic: '/tʂɪˈtɨrʲe/' },
  { word: 'пять', translation: 'five', phonetic: '/pʲatʲ/' },
  { word: 'шесть', translation: 'six', phonetic: '/ʂestʲ/' },
  { word: 'семь', translation: 'seven', phonetic: '/sʲemʲ/' },
  { word: 'восемь', translation: 'eight', phonetic: '/ˈvosʲɪmʲ/' },
  { word: 'девять', translation: 'nine', phonetic: '/ˈdʲevʲɪtʲ/' },
  { word: 'десять', translation: 'ten', phonetic: '/ˈdʲesʲɪtʲ/' }
];

const UserSettings = ({ onApiKeySet, hasApiKey, aiVocabulary = [] }: UserSettingsProps) => {
  const { user, signOut } = useAuth();
  const { settings, updateSetting, loading } = useUserSettings();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Combine hardcoded vocabulary with AI-provided vocabulary
  const allVocabulary = [
    ...russianVocabulary.map(item => ({
      word: item.word,
      translation: item.translation,
      phonetic: item.phonetic,
      examples: undefined // Hardcoded vocabulary doesn't have examples
    })),
    ...aiVocabulary.map(item => ({
      word: item.word,
      translation: item.definition,
      phonetic: '', // AI doesn't provide phonetics
      examples: item.examples
    }))
  ];

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
    toast({
      title: "Signed out successfully",
      description: "You have been signed out of your account.",
    });
  };

  const handleThemeToggle = async (checked: boolean) => {
    await updateSetting('theme', checked ? 'dark' : 'light');
    
    // Apply theme to document
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleAutoSpeakToggle = async (checked: boolean) => {
    await updateSetting('auto_speak', checked);
  };

  const handleSaveApiKey = async () => {
    if (apiKey.trim()) {
      await updateSetting('gemini_api_key', apiKey.trim());
      onApiKeySet(apiKey.trim());
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved successfully.",
      });
    }
  };

  const playRussianAudio = (russianText: string) => {
    const utterance = new SpeechSynthesisUtterance(russianText);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.8;
    utterance.pitch = 1;
    
    const voices = speechSynthesis.getVoices();
    const russianVoice = voices.find(voice => voice.lang.startsWith('ru'));
    if (russianVoice) {
      utterance.voice = russianVoice;
    }
    
    speechSynthesis.speak(utterance);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Info */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium">{user.user_metadata?.full_name || 'User'}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </Card>

          {/* API Key Setting */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <Label className="font-medium">Gemini API Key</Label>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()} size="sm">
                    Save API Key
                  </Button>
                  <Badge variant="outline">
                    <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Get your free API key here
                    </a>
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Theme Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings?.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <Label htmlFor="theme-toggle">Dark Theme</Label>
            </div>
            <Switch
              id="theme-toggle"
              checked={settings?.theme === 'dark'}
              onCheckedChange={handleThemeToggle}
              disabled={loading}
            />
          </div>

          {/* Auto-speak Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <Label htmlFor="auto-speak-toggle">Auto-speak AI responses</Label>
            </div>
            <Switch
              id="auto-speak-toggle"
              checked={settings?.auto_speak || false}
              onCheckedChange={handleAutoSpeakToggle}
              disabled={loading}
            />
          </div>

          {/* Russian Vocabulary Section */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <Label className="font-medium">Russian Vocabulary ({allVocabulary.length} words)</Label>
              </div>
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {allVocabulary.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{item.word}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playRussianAudio(item.word)}
                          className="h-6 w-6 p-0"
                        >
                          <Volume2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{item.translation}</p>
                      {item.phonetic && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.phonetic}</p>
                      )}
                      {item.examples && item.examples.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Examples:</p>
                          {item.examples.map((example, exampleIndex) => (
                            <div key={exampleIndex} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>•</span>
                              <span className="flex-1">{example}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Sign Out */}
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            className="w-full flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSettings;
