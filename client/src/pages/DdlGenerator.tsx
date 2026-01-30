
import { Link as LinkIcon, Sparkles, Info, AlertCircle } from 'lucide-react';

// ✅ Import Step Images
import step1Img from '../assets/step1.jpg';
import step2Img from '../assets/step2.jpg';
import step3Img from '../assets/step3.jpg';
import step4Img from '../assets/step4.jpg';

const DdlGenerator = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500">
      
      {/* 1. HEADER SECTION */}
      <div className="px-8 py-8 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                <LinkIcon className="text-green-500" size={28} />
                Google Direct Download Link Generator 
                <Sparkles size={18} className="text-yellow-500 fill-yellow-500 animate-pulse" />
            </h1>
            <div className="mt-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 flex gap-3 items-start">
                <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    This tool helps you generate a direct download link for files stored in our Capytech Google Drive. 
                    With a direct link, the file will start downloading immediately instead of opening a preview in Google Drive. 
                    <span className="font-bold text-blue-600 dark:text-blue-400"> (Scroll down for instructions)</span>
                </p>
            </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT (Scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-12">
            
            {/* THE TOOL SECTION (Embedded Iframe) */}
            <section className="bg-white dark:bg-[#1A1D21] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl overflow-hidden h-[550px]">
                <iframe
                    src="https://capy-dev.com/demos/link_generator5.html"
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allowFullScreen
                    loading="lazy"
                    title="Google DDL Generator"
                />
            </section>

            {/* INSTRUCTIONS SECTION */}
            <section className="space-y-8 pb-20">
                <div className="flex items-center gap-3 border-b border-gray-200 dark:border-white/10 pb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wider font-heading">Instructions</h2>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 flex gap-4 items-center">
                    <AlertCircle className="text-amber-600 dark:text-amber-500 shrink-0" size={24} />
                    <div>
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm uppercase">Important Note</h4>
                        <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                            Make sure your file's visibility in Google Drive is set to <b>"Anyone with the link."</b> If it's set to "Restricted," 
                            only people who have been manually given access will be able to open the link.
                        </p>
                    </div>
                </div>

                {/* STEPS GRID - REVISED HEIGHT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {[
                        { step: 1, img: step1Img, text: "From our Google Drive, right-click the file you want to share, then click \"Share.\"" },
                        { step: 2, img: step2Img, text: "In the prompt window that appears, change the access setting to \"Anyone with the link.\"" },
                        { step: 3, img: step3Img, text: "Click \"Copy link.\"" },
                        { step: 4, img: step4Img, text: "Then paste the link into the text box above and click \"Create Direct Link\" to generate your link. Enjoy! 😊" }
                    ].map((item) => (
                        <div key={item.step} className="group flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black font-black text-xs shadow-sm">
                                    {item.step}
                                </span>
                                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">Step {item.step}</h3>
                            </div>
                            
                            {/* Improved Visual Card: Height increased to 4:3 ratio for better visibility */}
                            <div className="relative aspect-[4/3] rounded-2xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm group-hover:shadow-md group-hover:border-blue-500/30 transition-all duration-300">
                                <img 
                                    src={item.img} 
                                    alt={`Step ${item.step}`} 
                                    className="w-full h-full object-contain bg-gray-50 dark:bg-neutral-900" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed px-1">
                                {item.text}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

export default DdlGenerator;