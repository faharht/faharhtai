import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type UserSettings = Database['public']['Tables']['user_settings']['Row'];
type SettingKey = keyof Omit<UserSettings, 'id' | 'created_at' | 'updated_at'>;

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: SettingKey, value: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating setting:', error);
        return;
      }

      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const getApiKey = () => {
    return settings?.gemini_api_key || '';
  };

  return {
    settings,
    updateSetting,
    loading,
    refetch: fetchSettings,
    getApiKey,
  };
};