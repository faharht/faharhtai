import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { voiceService } from '@/services/voiceService';

interface VocabularyItem {
  word: string;
  definition?: string;
  translation?: string;
  phonetic?: string;
  examples?: string[];
  isCustom?: boolean;
}

const russianVocabulary: VocabularyItem[] = [
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
];

export default function VocabularyScreen() {
  const [customVocabulary, setCustomVocabulary] = useState<VocabularyItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newTranslation, setNewTranslation] = useState('');

  useEffect(() => {
    loadCustomVocabulary();
  }, []);

  const loadCustomVocabulary = async () => {
    try {
      const stored = await AsyncStorage.getItem('victorai_vocab');
      if (stored) {
        setCustomVocabulary(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    }
  };

  const saveCustomVocabulary = async (vocab: VocabularyItem[]) => {
    try {
      await AsyncStorage.setItem('victorai_vocab', JSON.stringify(vocab));
    } catch (error) {
      console.error('Error saving vocabulary:', error);
    }
  };

  const handleAddWord = () => {
    if (!newWord.trim() || !newTranslation.trim()) {
      Alert.alert('Error', 'Please fill in both word and translation');
      return;
    }

    const newItem: VocabularyItem = {
      word: newWord.trim(),
      translation: newTranslation.trim(),
      isCustom: true,
    };

    const updatedVocab = [...customVocabulary, newItem];
    setCustomVocabulary(updatedVocab);
    saveCustomVocabulary(updatedVocab);
    
    setNewWord('');
    setNewTranslation('');
    setShowAddModal(false);
  };

  const handleRemoveWord = (word: string) => {
    Alert.alert(
      'Remove Word',
      `Are you sure you want to remove "${word}" from your vocabulary?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedVocab = customVocabulary.filter(item => item.word !== word);
            setCustomVocabulary(updatedVocab);
            saveCustomVocabulary(updatedVocab);
          },
        },
      ]
    );
  };

  const handleSpeak = async (word: string) => {
    try {
      await voiceService.speak(word);
    } catch (error) {
      Alert.alert('Error', 'Failed to speak word');
    }
  };

  const allVocabulary = [...russianVocabulary, ...customVocabulary];

  const renderVocabularyItem = ({ item }: { item: VocabularyItem }) => (
    <View style={styles.vocabularyItem}>
      <View style={styles.wordHeader}>
        <Text style={styles.word}>{item.word}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.speakButton}
            onPress={() => handleSpeak(item.word)}
          >
            <Ionicons name="volume-high" size={20} color="#3b82f6" />
          </TouchableOpacity>
          {item.isCustom && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveWord(item.word)}
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {(item.translation || item.definition) && (
        <Text style={styles.translation}>
          {item.translation || item.definition}
        </Text>
      )}
      
      {item.phonetic && (
        <Text style={styles.phonetic}>{item.phonetic}</Text>
      )}
      
      {item.examples && item.examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Examples:</Text>
          {item.examples.map((example, index) => (
            <Text key={index} style={styles.example}>• {example}</Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vocabulary</Text>
        <Text style={styles.headerSubtitle}>{allVocabulary.length} words</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={allVocabulary}
        renderItem={renderVocabularyItem}
        keyExtractor={(item, index) => `${item.word}-${index}`}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Word</Text>
            <TouchableOpacity onPress={handleAddWord}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Russian Word</Text>
              <TextInput
                style={styles.input}
                value={newWord}
                onChangeText={setNewWord}
                placeholder="Enter Russian word or phrase"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>English Translation</Text>
              <TextInput
                style={styles.input}
                value={newTranslation}
                onChangeText={setNewTranslation}
                placeholder="Enter English translation"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  vocabularyItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  word: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  speakButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  translation: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  phonetic: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  examplesContainer: {
    marginTop: 8,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  example: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  saveButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
});