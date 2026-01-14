

export default function ScormExtractor() {
  // The URL of your external app
  const embedUrl = "https://dam.capy-dev.com/scorm/";

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