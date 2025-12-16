"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
// Initialize Supabase
// Ensure these keys are in your server/.env file
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const uploadToSupabase = async (filePath, destinationPath, mimeType) => {
    try {
        const fileContent = fs_1.default.readFileSync(filePath);
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
    }
    catch (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error('Failed to upload to cloud storage');
    }
};
exports.uploadToSupabase = uploadToSupabase;
