import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
// Ensure these are in your .env file
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Use Service Role Key for better delete permissions if possible
const BUCKET_NAME = 'assets'; 

// Initialize Client
export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. UPLOAD FUNCTION
// ==========================================
export const uploadToSupabase = async (
  filePath: string, 
  destinationPath: string, 
  mimeType: string
): Promise<string> => {
  try {
    const fileContent = fs.readFileSync(filePath);

    // Upload file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME) 
      .upload(destinationPath, fileContent, {
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

// ==========================================
// 2. DELETE FUNCTION (✅ Added this)
// ==========================================
export const deleteFromSupabase = async (filePath: string): Promise<void> => {
  try {
    if (!filePath) return;

    // Helper: Extract relative path if the DB stores the full Public URL
    // e.g. "https://xyz.supabase.co/.../assets/folder/image.png" -> "folder/image.png"
    let pathClean = filePath;
    
    // If it is a full URL, strip the domain and bucket part
    if (filePath.startsWith('http')) {
        const urlParts = filePath.split(`${BUCKET_NAME}/`);
        if (urlParts.length > 1) {
            // Takes everything after "assets/"
            pathClean = urlParts.slice(1).join(`${BUCKET_NAME}/`); 
        }
    }

    // Perform Delete
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([pathClean]);

    if (error) {
      console.error(`Supabase Delete Error for ${pathClean}:`, error.message);
    } else {
      console.log(`🗑️ Deleted from Supabase: ${pathClean}`);
    }
  } catch (err) {
    console.error('Delete from Supabase failed:', err);
    // We do not throw here to prevent crashing the server/cron job 
    // if a file is already missing
  }
};