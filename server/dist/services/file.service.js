"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromFile = void 0;
const mammoth_1 = __importDefault(require("mammoth"));
// ✅ FIX: Use 'require' for pdf-parse to avoid the "not callable" TS error
const pdf = require('pdf-parse');
const extractTextFromFile = async (file) => {
    const mimeType = file.mimetype;
    const buffer = file.buffer;
    try {
        // 1. Handle PDF
        if (mimeType === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        }
        // 2. Handle Word (.docx)
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth_1.default.extractRawText({ buffer: buffer });
            return result.value;
        }
        // 3. Handle Plain Text (.txt)
        else if (mimeType === 'text/plain') {
            return buffer.toString('utf-8');
        }
        throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
    }
    catch (error) {
        console.error("File Extraction Error:", error);
        throw new Error("Could not read text from file.");
    }
};
exports.extractTextFromFile = extractTextFromFile;
