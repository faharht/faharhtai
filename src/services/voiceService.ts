import * as Speech from 'expo-speech';

export class VoiceService {
  private isListening = false;

  async startListening(): Promise<string> {
    // Note: React Native doesn't have built-in speech recognition
    // You would need to implement this using a third-party library
    // like @react-native-voice/voice or expo-speech-recognition
    throw new Error('Speech recognition not implemented in React Native version');
  }

  stopListening() {
    this.isListening = false;
  }

  async speak(text: string): Promise<void> {
    // Stop any current speech
    Speech.stop();

    // Remove text in parentheses (e.g., pronunciation hints)
    const cleanedText = text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

    // Split into words and group by language
    const words = cleanedText.split(/(\s+)/); // keep spaces
    const groups: { lang: string, text: string }[] = [];
    let currentLang: string | null = null;
    let buffer = '';
    const isRussian = (w: string) => /[а-яА-ЯёЁ]/.test(w);

    for (const word of words) {
      if (/^\s+$/.test(word)) {
        buffer += word;
        continue;
      }
      const lang = isRussian(word) ? 'ru' : 'en';
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

    // Speak each group sequentially
    for (const group of groups) {
      await Speech.speak(group.text, {
        language: group.lang === 'ru' ? 'ru-RU' : 'en-US',
        rate: 0.9,
        pitch: 1.0,
      });
    }
  }

  stopSpeaking() {
    Speech.stop();
  }

  get isCurrentlyListening() {
    return this.isListening;
  }
}

export const voiceService = new VoiceService();