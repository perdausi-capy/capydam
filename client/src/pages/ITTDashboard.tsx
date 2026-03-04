import { useState } from 'react';
import { Shield, Monitor, Wrench, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ITTWorkstations from './ITTWorkstations';
import ITTLedger from './ITTLedger';
import ITTReports from './ITTReports';

const ITTDashboard = () => {
    const [activeTab, setActiveTab] = useState<'workstations' | 'ledger' | 'reports'>('workstations');

    return (
        <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] text-gray-900 dark:text-white p-6 lg:p-12 transition-colors duration-500 relative overflow-hidden font-sans">

            {/* Background Orbs */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">

                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-6 duration-700">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm">
                                <Shield className="w-8 h-8" strokeWidth={2} />
                            </div>
                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-500">
                                ITT System
                            </h1>
                        </div>
                        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl ml-1">
                            Manage hardware workstations, track maintenance history, and log daily technician reports.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                        >
                            <ArrowLeft size={16} /> Back to App
                        </Link>
                    </div>
                </div>

                {/* --- TAB NAVIGATION --- */}
                <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 bg-white/60 dark:bg-[#121418] border border-gray-200 dark:border-white/5 p-2 rounded-2xl shadow-sm backdrop-blur-md sticky top-6 z-20">
                    {[
                        { id: 'workstations', icon: Monitor, label: 'Workstations' },
                        { id: 'ledger', icon: Wrench, label: 'Maintenance Ledger' },
                        { id: 'reports', icon: FileText, label: 'Daily Reports' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                        ${activeTab === tab.id
                                    ? 'bg-gray-900 text-white dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                                }
                    `}
                        >
                            <tab.icon size={18} strokeWidth={2} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* --- CONTENT AREA --- */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {activeTab === 'workstations' && <ITTWorkstations />}
                    {activeTab === 'ledger' && <ITTLedger />}
                    {activeTab === 'reports' && <ITTReports />}
                </div>

            </div>
        </div>
    );
};

export default ITTDashboard;
