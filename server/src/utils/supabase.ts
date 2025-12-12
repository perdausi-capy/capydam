import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Initialize Supabase
// Ensure these keys are in your server/.env file
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadToSupabase = async (
  filePath: string, 
  destinationPath: string, 
  mimeType: string
): Promise<string> => {
  try {
    const fileContent = fs.readFileSync(filePath);

    // 1. Upload file
    // ⚠️ Make sure you have a bucket named 'assets' in your Supabase project
    const { data, error } = await supabase.storage
      .from('assets') 
      .upload(destinationPath, fileContent, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // 2. Get Public URL
    const { data: publicData } = supabase.storage
      .from('assets')
      .getPublicUrl(destinationPath);

    return publicData.publicUrl;
  } catch (error) {
    console.error('Supabase Upload Error:', error);
    throw new Error('Failed to upload to cloud storage');
  }
};