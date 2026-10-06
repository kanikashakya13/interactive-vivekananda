import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezvrxsphaexdbpjgpaab.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnJ4c3BoYWV4ZGJwamdwYWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMzE5ODMsImV4cCI6MjEwNjcwNzk4M30.pfjC_4EpEIBtg_-fO96flVv1gsfIU-Wu-nlKGomQwAE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);