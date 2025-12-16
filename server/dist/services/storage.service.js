"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromSupabase = exports.uploadToSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_extra_1 = __importDefault(require("fs-extra"));
// Initialize Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'assets';
const uploadToSupabase = async (localFilePath, destinationPath, mimeType) => {
    try {
        const fileBuffer = await fs_extra_1.default.readFile(localFilePath);
        // Upload
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(destinationPath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
        });
        if (error)
            throw error;
        // Get Public URL
        const { data: publicData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(destinationPath);
        return publicData.publicUrl;
    }
    catch (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error('Failed to upload to cloud storage');
    }
};
exports.uploadToSupabase = uploadToSupabase;
const deleteFromSupabase = async (pathUrl) => {
    try {
        // Extract relative path from full URL
        const pathParts = pathUrl.split(`${BUCKET_NAME}/`);
        if (pathParts.length < 2)
            return;
        const relativePath = pathParts[1];
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([relativePath]);
        if (error)
            throw error;
    }
    catch (error) {
        console.error('Supabase Delete Error:', error);
    }
};
exports.deleteFromSupabase = deleteFromSupabase;
