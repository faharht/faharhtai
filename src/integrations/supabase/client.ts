import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://gsahqipvjhzoyofphlqt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYWhxaXB2amh6b3lvZnBobHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNjk1ODcsImV4cCI6MjA2NTg0NTU4N30.Ly8-vlMrxgzc3vbmpe_ap7kLbDpTzju8PVKlcOFfwAM";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);