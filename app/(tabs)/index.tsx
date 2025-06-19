import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { voiceService } from '@/services/voiceService';
import { geminiService } from '@/services/geminiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  followUpQuestion?: string;
}

interface Chat {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { settings, getApiKey } = useUserSettings();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Check for API key
  useEffect(() => {
    const apiKey = getApiKey();
    if (apiKey) {
      geminiService.initialize(apiKey);
      setHasApiKey(true);
    } else {
      setHasApiKey(false);
    }
  }, [settings?.gemini_api_key, getApiKey]);

  // Load chats from AsyncStorage
  useEffect(() => {
    loadChats();
  }, []);

  // Save chats to AsyncStorage
  useEffect(() => {
    saveChats();
  }, [chats]);

  const loadChats = async () => {
    try {
      const stored = await AsyncStorage.getItem('victorai_chats');
      if (stored) {
        const parsed: Chat[] = JSON.parse(stored);
        setChats(parsed);
        if (parsed.length > 0) setActiveChatId(parsed[0].id);
      } else {
        createDefaultChat();
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      createDefaultChat();
    }
  };

  const saveChats = async () => {
    try {
      await AsyncStorage.setItem('victorai_chats', JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving chats:', error);
    }
  };

  const createDefaultChat = () => {
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
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat ? activeChat.messages : [];

  const setMessages = (msgs: Message[]) => {
    setChats(prev => prev.map(chat =>
      chat.id === activeChatId ? { ...chat, messages: msgs } : chat
    ));
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

    try {
      const conversationHistory = newMessages
        .slice(-6)
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');
      
      const aiResponse = await geminiService.generateVictorAIResponse(messageText, [conversationHistory]);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'victor',
        content: aiResponse.response,
        timestamp: new Date(),
        corrections: aiResponse.corrections,
        vocabularyTip: aiResponse.vocabularyTip,
        followUpQuestion: aiResponse.followUpQuestion
      };

      setMessages([...newMessages, aiMessage]);

      if (settings?.auto_speak) {
        setIsSpeaking(true);
        await voiceService.speak(aiResponse.response);
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('AI processing error:', error);
      Alert.alert('AI Error', 'Failed to get AI response. Please check your API key in settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!hasApiKey) {
      Alert.alert('API Key Required', 'Please set your Gemini API key in settings first');
      return;
    }

    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    try {
      setIsListening(true);
      const text = await voiceService.startListening();
      setIsListening(false);
      if (text) {
        setInputMessage(text);
        handleSendMessage(text);
      }
    } catch (error) {
      setIsListening(false);
      Alert.alert('Voice Input Error', error.message);
    }
  };

  const handleTextToSpeech = async (text: string) => {
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      await voiceService.speak(text);
      setIsSpeaking(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageContainer, item.type === 'user' ? styles.userMessage : styles.victorMessage]}>
      <View style={styles.messageHeader}>
        <View style={[styles.avatar, item.type === 'user' ? styles.userAvatar : styles.victorAvatar]}>
          <Text style={styles.avatarText}>{item.type === 'user' ? 'U' : 'В'}</Text>
        </View>
        <Text style={styles.senderName}>{item.type === 'user' ? 'You' : 'VictorAI'}</Text>
      </View>
      
      <View style={[styles.messageBubble, item.type === 'user' ? styles.userBubble : styles.victorBubble]}>
        <View style={styles.messageContent}>
          <Text style={[styles.messageText, item.type === 'user' ? styles.userText : styles.victorText]}>
            {item.content}
          </Text>
          {item.type === 'victor' && (
            <TouchableOpacity
              style={styles.speakButton}
              onPress={() => handleTextToSpeech(item.content)}
            >
              <Ionicons
                name={isSpeaking ? 'volume-mute' : 'volume-high'}
                size={16}
                color="#64748b"
              />
            </TouchableOpacity>
          )}
        </View>

        {item.corrections && item.corrections.length > 0 && (
          <View style={styles.correctionContainer}>
            <Text style={styles.correctionTitle}>Grammar Correction</Text>
            {item.corrections.map((correction, index) => (
              <View key={index} style={styles.correction}>
                <Text style={styles.correctionText}>
                  <Text style={styles.originalText}>{correction.original}</Text>
                  {' → '}
                  <Text style={styles.correctedText}>{correction.corrected}</Text>
                </Text>
                <Text style={styles.explanationText}>{correction.explanation}</Text>
              </View>
            ))}
          </View>
        )}

        {item.vocabularyTip && (
          <View style={styles.vocabularyContainer}>
            <Text style={styles.vocabularyTitle}>Vocabulary</Text>
            <View style={styles.vocabularyContent}>
              <Text style={styles.vocabularyWord}>{item.vocabularyTip.word}</Text>
              <Text style={styles.vocabularyDefinition}>{item.vocabularyTip.definition}</Text>
              {item.vocabularyTip.examples.map((example, index) => (
                <Text key={index} style={styles.vocabularyExample}>• {example}</Text>
              ))}
            </View>
          </View>
        )}

        {item.followUpQuestion && (
          <View style={styles.followUpContainer}>
            <Text style={styles.followUpTitle}>Follow-up Question:</Text>
            <Text style={styles.followUpText}>{item.followUpQuestion}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (!hasApiKey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="book" size={48} color="white" />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to VictorAI!</Text>
          <Text style={styles.welcomeText}>
            To start learning Russian with AI-powered conversations, please set up your Gemini API key in the settings tab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VictorAI</Text>
        <Text style={styles.headerSubtitle}>Russian Language Tutor</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>VictorAI is thinking...</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={isListening ? "Listening..." : "Type your message..."}
            multiline
            editable={!isLoading && !isListening}
          />
          <TouchableOpacity
            style={[styles.voiceButton, isListening && styles.listeningButton]}
            onPress={handleVoiceInput}
            disabled={isLoading}
          >
            <Ionicons
              name={isListening ? 'mic-off' : 'mic'}
              size={20}
              color={isListening ? 'white' : '#3b82f6'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, (!inputMessage.trim() || isLoading || isListening) && styles.disabledButton]}
            onPress={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading || isListening}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 8,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  victorMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: '#3b82f6',
  },
  victorAvatar: {
    backgroundColor: '#ef4444',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  senderName: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: width * 0.8,
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    marginLeft: 40,
  },
  victorBubble: {
    backgroundColor: 'white',
    marginRight: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: 'white',
  },
  victorText: {
    color: '#1f2937',
  },
  speakButton: {
    marginLeft: 8,
    padding: 4,
  },
  correctionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  correctionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  correction: {
    marginBottom: 4,
  },
  correctionText: {
    fontSize: 14,
  },
  originalText: {
    textDecorationLine: 'line-through',
    color: '#dc2626',
  },
  correctedText: {
    fontWeight: '600',
    color: '#16a34a',
  },
  explanationText: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2,
  },
  vocabularyContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  vocabularyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c2d12',
    marginBottom: 4,
  },
  vocabularyContent: {
    gap: 4,
  },
  vocabularyWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  vocabularyDefinition: {
    fontSize: 14,
    color: '#4b5563',
  },
  vocabularyExample: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  followUpContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  followUpTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  followUpText: {
    fontSize: 14,
    color: '#1e40af',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f9fafb',
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  listeningButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
});