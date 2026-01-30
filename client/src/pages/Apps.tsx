
import { useNavigate } from 'react-router-dom';
import { Box, FileCode, Database, ArrowRight, Link as LinkIcon } from 'lucide-react';

const apps = [
  {
    id: 'scorm',
    name: 'SCORM Extractor',
    description: 'Upload and unpack SCORM packages to view, edit, or extract internal assets.',
    icon: <FileCode size={32} className="text-orange-500" />,
    route: '/scorm-extractor',
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    isExternal: false
  },
  {
    id: 'jrd',
    name: 'JRD Assets',
    description: 'Specialized asset view for JRD project resources, specific filtering, and archives.',
    icon: <Database size={32} className="text-blue-500" />,
    route: '/jrd-assets',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    isExternal: false
  },
  {
    id: 'ddl-gen',
    name: 'Google DDL Generator',
    description: 'Generate direct download links for files stored in Capytech Google Drive.',
    icon: <LinkIcon size={32} className="text-green-500" />,
    route: '/ddl-generator', // ✅ Point to the new internal route
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    isExternal: false,       // ✅ Change to false
    openInNewTab: false      // ✅ Change to false
  }
];

const Apps = () => {
  const navigate = useNavigate();

  const handleAppClick = (app: typeof apps[0]) => {
    // 1. Priority: Force New Tab (Fixes Google Sites)
    // @ts-ignore - Ignoring TS error if property isn't defined on all objects yet
    if (app.openInNewTab) {
      window.open(app.route, '_blank', 'noopener,noreferrer');
      return;
    }

    // 2. Secondary: Try Embedded Viewer for other external tools
    if (app.isExternal) {
      navigate('/apps/view', { 
        state: { 
          url: app.route, 
          name: app.name 
        } 
      });
    } else {
      // 3. Internal Route
      navigate(app.route);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-6 lg:p-10 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
          <Box className="text-purple-600" /> CapyApps
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
          Centralized tools and utilities for your instructional design workflow.
        </p>
      </div>

      {/* APPS GRID */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app) => (
          <div 
            key={app.id}
            onClick={() => handleAppClick(app)}
            className={`
              relative group cursor-pointer rounded-3xl p-6 border transition-all duration-300
              hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-[#1A1D21] border-gray-200 dark:border-white/5
            `}
          >
            {/* ICON CONTAINER */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${app.color}`}>
              {app.icon}
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 transition-colors flex items-center gap-2">
              {app.name}
              {app.isExternal && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-md">External</span>
              )}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 h-12 line-clamp-2">
              {app.description}
            </p>

            <div className="flex items-center text-sm font-bold text-gray-400 group-hover:text-purple-600 transition-colors">
              {/* @ts-ignore */}
              {app.isExternal ? (app.openInNewTab ? 'Open in New Tab' : 'Launch Tool') : 'Open App'} 
              <ArrowRight size={16} className={`ml-2 transition-transform ${app.isExternal ? '-rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : 'group-hover:translate-x-1'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Apps;