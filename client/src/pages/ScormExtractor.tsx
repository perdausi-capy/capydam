import React from 'react';

export default function ScormExtractor() {
  // The URL of your external app
  const embedUrl = "http://192.168.100.10:3000/";

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <iframe
        src={embedUrl}
        title="Scorm Extractor"
        width="100%"
        height="100%"
        style={{ border: 'none' }}
        allowFullScreen
      />
    </div>
  );
}