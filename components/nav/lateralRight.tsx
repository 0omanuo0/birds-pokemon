"use client";
import { useState, useRef, useEffect } from 'react';
import { arrowBoxLeftSvg, CameraSvg } from '../imageSvg';
import { useRouter } from 'next/navigation';


export default function LateralRight({children, target, setTop, onAction}: { children?: React.JSX.Element, target?: string, setTop? :  string | number , onAction?: () => void }) {
    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    const [offsetRight, setOffsetRight] = useState(0);
    const [timerTouch, setTimerTouch] = useState<NodeJS.Timeout | null>(null);
    const draggingRef = useRef(false);
    const startXRef = useRef(0);
    const startOffsetRef = useRef(0);
    const router = useRouter();

    // MOVE handler (mouse or touch)
    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!draggingRef.current) return;
        e.preventDefault();
        const clientX =
            e instanceof TouchEvent
                ? e.touches[0].clientX
                : (e as MouseEvent).clientX;

        const deltaX = clientX - startXRef.current;
        let newOffset = startOffsetRef.current + deltaX;
        // clamp between -80 and 0
        newOffset = Math.min(0, Math.max(-80, newOffset));
        setOffsetRight(newOffset);
    };

    // END handler: stop dragging, remove listeners
    const handleEnd = () => {
        clearTimeout(timerTouch!);
        setTimerTouch(null);
        draggingRef.current = false;
        // snap to -90 if offset is less than -45, else snap to 0
        setOffsetRight(prev => (prev < -55 ? -80 : 0));
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    };

    // START handler: set up refs and add listeners
    const startDrag = (
        e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
        e.preventDefault();

        if (isIOS) {
            setTimerTouch(setTimeout(() => {
                if (target) {
                    router.push(target);
                } else {
                    onAction?.();
                }
                clearTimeout(timerTouch!);
                setTimerTouch(null);
            }, 500));
        }

        setOffsetRight(-30);
        draggingRef.current = true;
        startXRef.current =
            'touches' in e ? e.touches[0].clientX : e.clientX;
        startOffsetRef.current = offsetRight;

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        // passive: false so e.preventDefault() actually blocks scrolling
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
    };

    // cleanup if unmounted mid-drag
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, []);

    useEffect(() => {
        // if arrives to 80, navigate to /
        if (offsetRight === -80) {
            if (target) {
                router.push(target);
            } else if (onAction) {
                onAction();
            }
            setTimeout(() => {
                setOffsetRight(0); // reset offset after navigation
            }, 400);
        }
    }, [offsetRight]);

    return (
        <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onTouchEnd={(e) => {
                e.stopPropagation();
                if (timerTouch) {
                    clearTimeout(timerTouch);
                    setTimerTouch(null);
                }
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation();
                if (target) {
                    router.push(target);
                } else {
                    onAction?.();
                }
            }}
            style={{
                clipPath: "polygon(20% 0, 100% 0, 100% 100%, 20% 100%, 5% 85%, 5% 15%)",
                right: `${-80 - offsetRight}px`,
                position: 'absolute',
                bottom: "170px", 
                cursor: 'grab',
                transition: 'right 0.2s ease-out',
                background: "linear-gradient(160deg, #e85d63, #c63f44 70%)",
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
            }}
            className='h-[96px] w-[120px] z-90 flex items-center justify-between px-2'
        >
            {/* Optional decorative border with SVG */}
            <svg
                className='absolute top-0 left-0 h-[96px] w-[120px] pointer-events-none'
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                <polygon
                    points="20,0 130,0 130,100 20,100 5,85 5,15"
                    fill="transparent"
                    stroke="#404040aa"
                    strokeWidth="3"
                />
            </svg>

            {/* Left icon */}
            <div className='flex items-center justify-center w-[28px] h-[28px] mx-[2px]'>
                {children}
            </div>

            {/* Vertical Divider */}
            <div className='h-2/3 w-1 border-r-2 border-neutral-700/40 mx-2'></div>

            {/* Main icon */}
            <div className='flex items-center justify-center flex-1'>
                {/* <span className='text-white text-xl'>{arrowBoxLeftSvg}</span> */}
            </div>
        </div>
    );
}