export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  startListening(onResult: (text: string) => void, onEnd: () => void, onError: (error: string) => void) {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    if (this.isListening) return;

    this.isListening = true;
    
    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        onResult(finalTranscript.trim());
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.start();
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  async speak(text: string, onEnd?: () => void) {
    this.synthesis.cancel();

    // Remove text in parentheses (e.g., pronunciation hints)
    const cleanedText = text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

    // Split into words and group by language
    const words = cleanedText.split(/(\s+)/); // keep spaces
    const groups: { lang: 'en-US' | 'ru-RU', text: string }[] = [];
    let currentLang: 'en-US' | 'ru-RU' | null = null;
    let buffer = '';
    const isRussian = (w: string) => /[а-яА-ЯёЁ]/.test(w);

    for (const word of words) {
      if (/^\s+$/.test(word)) {
        buffer += word;
        continue;
      }
      const lang = isRussian(word) ? 'ru-RU' : 'en-US';
      if (currentLang === null) {
        currentLang = lang;
        buffer = word;
      } else if (lang === currentLang) {
        buffer += word;
      } else {
        groups.push({ lang: currentLang, text: buffer });
        currentLang = lang;
        buffer = word;
      }
    }
    if (buffer) {
      groups.push({ lang: currentLang!, text: buffer });
    }

    // Get voices
    const voices = this.synthesis.getVoices();
    const getVoice = (lang: 'en-US' | 'ru-RU') => {
      if (lang === 'ru-RU') {
        return voices.find(v => v.lang.startsWith('ru')) || null;
      } else {
        return voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
               voices.find(v => v.lang.startsWith('en')) || null;
      }
    };

    // Speak each group sequentially
    const speakGroup = (i: number) => {
      if (i >= groups.length) {
        if (onEnd) onEnd();
        return;
      }
      const { lang, text } = groups[i];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.voice = getVoice(lang);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => speakGroup(i + 1);
      this.synthesis.speak(utterance);
    };
    if (groups.length > 0) {
      speakGroup(0);
    } else if (onEnd) {
      onEnd();
    }
  }

  stopSpeaking() {
    this.synthesis.cancel();
  }

  get isCurrentlyListening() {
    return this.isListening;
  }
}

export const voiceService = new VoiceService();
