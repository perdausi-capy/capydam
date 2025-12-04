import { createClient } from '@supabase/supabase-js';
import fs from 'fs-extra';

// Initialize Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'assets';

export const uploadToSupabase = async (
  localFilePath: string, 
  destinationPath: string, 
  mimeType: string
): Promise<string> => {
  try {
    const fileBuffer = await fs.readFile(localFilePath);

    // Upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(destinationPath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    // Get Public URL
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(destinationPath);

    return publicData.publicUrl;
  } catch (error) {
    console.error('Supabase Upload Error:', error);
    throw new Error('Failed to upload to cloud storage');
  }
};

export const deleteFromSupabase = async (pathUrl: string) => {
  try {
    // Extract relative path from full URL
    const pathParts = pathUrl.split(`${BUCKET_NAME}/`);
    if (pathParts.length < 2) return; 
    
    const relativePath = pathParts[1]; 

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([relativePath]);

    if (error) throw error;
  } catch (error) {
    console.error('Supabase Delete Error:', error);
  }
};