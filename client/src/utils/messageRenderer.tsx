// import React from 'react';
// import DOMPurify from 'dompurify'; // Recommended but optional if you trust your users. 
// // If you don't have DOMPurify installed, you can skip the sanitize step for now, 
// // but for production, run: npm install dompurify @types/dompurify

export const renderMessageContent = (content: string) => {
    if (!content) return null;

    // 1. Check for GIF links strictly (exact match ending in .gif from Giphy picker)
    if (content.match(/^https?:\/\/.*\.(gif)(\?.*)?$/i)) {
        return (
            <img 
                src={content} 
                alt="gif" 
                className="rounded-xl max-w-[250px] border border-gray-200 dark:border-white/10 mt-1 shadow-sm" 
            />
        );
    }

    // 2. Render HTML Content (WYSIWYG Output)
    // Since our ChatInput now produces HTML <b>...</b>, we can render it directly.
    
    // Note: We use a simple div with dangerouslySetInnerHTML.
    // In a real app, use DOMPurify.sanitize(content)
    
    return (
        <div 
            className="text-[15px] leading-relaxed break-words text-gray-800 dark:text-gray-100 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:my-1 [&>blockquote]:border-l-4 [&>blockquote]:border-gray-500 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-gray-400"
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
};