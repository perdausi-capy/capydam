import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Grid, ZoomIn, ZoomOut, Maximize, Minimize, Lock, LockOpen } from 'lucide-react';
import client from '../api/client';

export interface UserInfo {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

export interface Workstation {
    id: string;
    unitId: string;
    status: string;
    assignedTo?: UserInfo;
    [key: string]: any;
}

interface WorkstationFloorPlanProps {
    workstations: Workstation[];
    filteredWorkstations: Workstation[];
    onOpenDetail: (ws: any) => void;
    unreadMap: Record<string, number>;
}



const statusBorderColors: Record<string, string> = {
    active: 'border-green-500/50',
    maintenance: 'border-amber-500/50',
    retired: 'border-red-500/50',
    animation_ready: 'border-purple-500/50',
    dev_ready: 'border-cyan-500/50',
};

const statusBgColors: Record<string, string> = {
    active: 'bg-green-500/10',
    maintenance: 'bg-amber-500/10',
    retired: 'bg-red-500/10',
    animation_ready: 'bg-purple-500/10',
    dev_ready: 'bg-cyan-500/10',
};

const statusDotColors: Record<string, string> = {
    active: 'bg-green-500',
    maintenance: 'bg-amber-500',
    retired: 'bg-red-500',
    animation_ready: 'bg-purple-500',
    dev_ready: 'bg-cyan-500',
};

const statusLabels: Record<string, string> = {
    active: 'Active',
    maintenance: 'Maintenance',
    retired: 'Retired',
    animation_ready: 'Animation Ready',
    dev_ready: 'Dev Ready',
};

export const WorkstationFloorPlan: React.FC<WorkstationFloorPlanProps> = ({
    workstations,
    filteredWorkstations,
    onOpenDetail,
    unreadMap
}) => {
    const [positions, setPositions] = useState<Record<string, { x: number; y: number; w?: number; h?: number }>>({});
    const [isLoadingLayout, setIsLoadingLayout] = useState(true);

    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [panPos, setPanPos] = useState({ x: 0, y: 0 });
    const [isLocked, setIsLocked] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load positions from API once on mount
    useEffect(() => {
        const fetchLayout = async () => {
            try {
                const res = await client.get('/itt/floorplan');
                setPositions(res.data || {});
            } catch (err) {
                console.error("Failed to parse floor plan positions from server", err);
            } finally {
                setIsLoadingLayout(false);
            }
        };
        fetchLayout();
    }, []);

    // Autosave positions to server securely and debounced
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        if (isLoadingLayout) return;

        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await client.post('/itt/floorplan', positions);
            } catch (err) {
                console.error("Failed to sync floor plan to server", err);
            }
        }, 1000);

        return () => clearTimeout(saveTimer.current);
    }, [positions, isLoadingLayout]);

    // Helper to find spacing
    const initialGridAlign = (index: number) => {
        const columns = 5;
        const row = Math.floor(index / columns);
        const col = index % columns;
        return { x: col * 180 + 20, y: row * 120 + 20 };
    };

    const handleDragEnd = (id: string, info: any, currentPos: { x: number, y: number }) => {
        let newX = currentPos.x + (info.offset.x / zoom);
        let newY = currentPos.y + (info.offset.y / zoom);

        // Smart Snapping (Magnetic Alignment) to other cards
        const SNAP_THRESHOLD = 20;
        let snappedX = false;
        let snappedY = false;

        const targetPositions = workstations
            .filter(w => w.id !== id)
            .map((w, i) => positions[w.id] || initialGridAlign(i));

        for (const tPos of targetPositions) {
            if (!snappedX && Math.abs(newX - tPos.x) < SNAP_THRESHOLD) {
                newX = tPos.x;
                snappedX = true;
            }
            if (!snappedY && Math.abs(newY - tPos.y) < SNAP_THRESHOLD) {
                newY = tPos.y;
                snappedY = true;
            }
            if (snappedX && snappedY) break;
        }

        const newPos = { ...positions, [id]: { ...positions[id], x: newX, y: newY } };
        setPositions(newPos);
    };

    const handleResizeStart = (e: React.PointerEvent, id: string, currentW: number, currentH: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = (moveEvent.clientX - startX) / zoom;
            const deltaY = (moveEvent.clientY - startY) / zoom;
            let newW = Math.max(120, currentW + deltaX);
            let newH = Math.max(130, currentH + deltaY);

            setPositions(prev => ({
                ...prev,
                [id]: { ...prev[id], w: newW, h: newH }
            }));
        };

        const handlePointerUp = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const handlePanEnd = (_e: any, info: any) => {
        const dx = info.offset.x / zoom;
        const dy = info.offset.y / zoom;

        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

        setPositions(prev => {
            const next = { ...prev };
            workstations.forEach((ws, i) => {
                const p = next[ws.id] || initialGridAlign(i);
                next[ws.id] = { ...p, x: p.x + dx, y: p.y + dy };
            });
            return next;
        });

        setPanPos({ x: -info.offset.x * 0.0001, y: -info.offset.y * 0.0001 });
        setTimeout(() => setPanPos({ x: 0, y: 0 }), 10);
    };


    const filteredIds = new Set(filteredWorkstations.map(ws => ws.id));

    return (
        <div className={`flex flex-col bg-white dark:bg-[#0f1114] transition-all bg-white dark:bg-[#0f1114] ${isFullscreen ? 'fixed inset-0 z-[500] rounded-none' : 'h-[calc(100vh-280px)] min-h-[600px] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden'}`}>
            {/* Toolbar */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Grid size={16} className="text-blue-500" /> Virtual Floor Plan
                    </h3>
                    <span className="text-xs text-gray-500 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">
                        {workstations.length} Units
                    </span>
                </div>

                {/* Legend */}
                <div className="hidden sm:flex items-center gap-3 flex-wrap">
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[key]}`} />
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    {/* Zoom Bar */}
                    <div className="flex items-center gap-2 bg-gray-200 dark:bg-white/5 px-2 py-1.5 rounded-lg flex-shrink-0">
                        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="text-gray-500 hover:text-blue-500 transition-colors">
                            <ZoomOut size={14} />
                        </button>
                        <input
                            type="range"
                            min="0.2" max="2" step="0.1"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-20 accent-blue-500 h-1 bg-gray-300 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="text-gray-500 hover:text-blue-500 transition-colors">
                            <ZoomIn size={14} />
                        </button>
                        <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{Math.round(zoom * 100)}%</span>
                    </div>

                    <button
                        onClick={() => setIsLocked(prev => !prev)}
                        title={isLocked ? 'Unlock Layout' : 'Lock Layout'}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors uppercase tracking-widest px-3 py-1.5 rounded-lg ${isLocked
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                                : 'bg-gray-200 dark:bg-white/5 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400'
                            }`}
                    >
                        {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                        {isLocked ? 'Locked' : 'Lock Layout'}
                    </button>

                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors ml-1 p-1.5 rounded-lg bg-gray-200 dark:bg-white/5"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className="relative flex-1 overflow-auto bg-gray-50 dark:bg-[#121418] w-full h-full custom-scrollbar"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                }}
            >
                {/* Expanding wrapper to ensure scrolling works if dragged out of view */}
                <motion.div
                    drag={!isLocked}
                    dragMomentum={false}
                    animate={{ x: panPos.x, y: panPos.y, scale: zoom }}
                    onDragEnd={handlePanEnd}
                    style={{ transformOrigin: "0 0" }}
                    className={`absolute w-[200vw] h-[200vh] ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                >
                    {workstations.map((ws, i) => {
                        const pos = positions[ws.id] || initialGridAlign(i);
                        const boxW = pos.w || 140;
                        const boxH = pos.h || 150;
                        const isFiltered = filteredIds.has(ws.id);
                        const unreadCount = unreadMap[ws.assignedTo?.id || ''] || 0;

                        return (
                            <motion.div
                                key={ws.id}
                                drag={!isLocked}
                                dragMomentum={false}
                                initial={false}
                                animate={{ x: pos.x, y: pos.y, width: boxW, height: boxH }}
                                onDragEnd={(_e, info) => handleDragEnd(ws.id, info, pos)}
                                whileDrag={!isLocked ? { scale: 1.05, zIndex: 100, cursor: 'grabbing', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' } : {}}
                                className={`absolute select-none rounded-xl border backdrop-blur-md shadow-lg p-2.5 flex flex-col overflow-hidden
                                ${isLocked ? 'cursor-default' : 'cursor-grab'}
                                ${isFiltered ? 'opacity-100 z-10' : 'opacity-30 z-0 grayscale'}
                                ${statusBorderColors[ws.status] || 'border-white/10'}
                                ${statusBgColors[ws.status] || 'bg-white/5'}
                            `}
                            >
                                <div className="absolute -top-1 -right-1 flex gap-1 z-10">
                                    {unreadCount > 0 && (
                                        <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full shadow-md animate-pulse ring-2 ring-[#121418]">
                                            {unreadCount}
                                        </span>
                                    )}
                                    <div className={`w-2 h-2 rounded-full ring-2 ring-[#121418] mt-1 mr-1 ${statusDotColors[ws.status] || 'bg-gray-500'}`} />
                                </div>

                                <div
                                    className="flex flex-col items-center flex-1 h-full w-full"
                                    onDoubleClick={() => onOpenDetail(ws)}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 border border-white/10 flex items-center justify-center shadow-inner text-gray-700 dark:text-gray-300 shrink-0 mb-1.5">
                                        <Monitor size={20} />
                                    </div>
                                    <div className="flex-1 flex items-center justify-center w-full">
                                        <h4 className="text-white font-black text-[11px] leading-tight tracking-wide text-center uppercase line-clamp-3">
                                            {ws.unitId}
                                        </h4>
                                    </div>

                                    <div className="w-full bg-black/20 rounded-lg p-1.5 mt-auto border border-white/5 flex items-center justify-center gap-2 shrink-0">
                                        {ws.assignedTo ? (
                                            <>
                                                <div className="w-4 h-4 rounded-full overflow-hidden bg-blue-500 shrink-0 flex items-center justify-center text-[8px] font-bold text-white">
                                                    {ws.assignedTo.avatar ? (
                                                        <img src={ws.assignedTo.avatar} alt="avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        ws.assignedTo.name.charAt(0)
                                                    )}
                                                </div>
                                                <span className="text-[9px] text-gray-300 font-medium truncate">
                                                    {ws.assignedTo.name.split(' ')[0]}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                Empty
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* --- Custom Resize Handle --- */}
                                {!isLocked && (
                                    <div
                                        onPointerDownCapture={(e) => handleResizeStart(e, ws.id, boxW, boxH)}
                                        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-20 flex items-end justify-end p-1.5 text-gray-500 hover:text-white"
                                    >
                                        <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                                            <path d="M6 6L6 0L0 6H6Z" />
                                        </svg>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            {/* Instruction tooltip */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur text-white/50 text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full border border-white/10">
                {isLocked ? 'Layout locked • Double-click to view details' : 'Drag to move • Double-click to view details'}
            </div>
        </div>
    );
};
