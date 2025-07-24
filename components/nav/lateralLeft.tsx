"use client";
import { useState, useRef, useEffect } from 'react';
import { arrowBoxLeftSvg } from '../imageSvg';
import { useRouter } from 'next/navigation';
import { clear } from 'console';


export default function LateralLeft({children, target, setTop}: { children?: React.JSX.Element, target?: string, setTop?: string | number }) {
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
        newOffset = Math.min(80, Math.max(0, newOffset));
        setOffsetRight(newOffset);
    };

    // END handler: stop dragging, remove listeners
    const handleEnd = () => {
        clearTimeout(timerTouch!);
        draggingRef.current = false;
        // snap to 0 if offset is greater than 15, else snap to 80
        setOffsetRight(prev => (prev < 15 ? 0 : 80));
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

        router.prefetch(target || '/');
        if (isIOS) {
            setTimerTouch(setTimeout(() => {
                router.push(target || '/');
            }, 500));
        }

        setOffsetRight(10);
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
        if (offsetRight === 80) {
            router.push(target || '/');
        }
    }, [offsetRight]);

    return (
        <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
                e.preventDefault()
                router.push(target || '/');
            }}
            style={{
                clipPath: "polygon(85% 0, 100% 15%, 100% 85%, 85% 100%, 0 100%, 0 0)",
                left: `${-80 + offsetRight}px`,
                position: 'absolute',
                bottom:  "170px",
                cursor: 'grab',
                transition: 'left 0.2s ease-out',
                background: "linear-gradient(160deg, #e85d63, #c63f44 70%)",
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
                    points="85 0, 100 15, 100 85, 85 100, 0 100, 0 0"
                    fill="transparent"
                    stroke="#404040aa"
                    strokeWidth="3"
                />
            </svg>
            <div className='flex items-center justify-center flex-1'>
                {/* <span className='text-white text-xl'>{arrowBoxLeftSvg}</span> */}
            </div>
            <div className='h-2/3 w-1 border-r-2 border-neutral-700/40 mx-2'></div>


            <div className='flex items-center justify-center w-[28px] h-[28px] mx-[2px]'>
                {children }
            </div>

            
        </div>
    );
}