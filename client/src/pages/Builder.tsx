import { useEffect, useState } from 'react';

const Builder = () => {
  const [height, setHeight] = useState(
    window.innerWidth >= 1024 ? '100vh' : 'calc(100vh - 64px)'
  );

  useEffect(() => {
    const update = () =>
      setHeight(window.innerWidth >= 1024 ? '100vh' : 'calc(100vh - 64px)');
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div style={{ height, width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <iframe
        src="/builder.html"
        title="Infographic Studio Builder"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default Builder;

