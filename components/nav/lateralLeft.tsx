"use client";
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';


// Slot layout by how many tabs share the side (n). Full class strings so Tailwind can see them.
// n=1: one full-height tab (96px) in the original slot, bottom = calc(50vw-32px) / 145px.
// n=2: two tabs at 2/3 height (64px) with an 8px gap, stacked around the centre of that same slot
// (centre = bottom + 48px). idx 0 = upper, 1 = lower.
const SINGLE_POSITION = "bottom-[calc(50vw-32px)] md:bottom-[145px]";
const DOUBLE_POSITIONS = [
    "bottom-[calc(50vw+20px)] md:bottom-[197px]",
    "bottom-[calc(50vw-52px)] md:bottom-[125px]",
];

// offsetY nudges the tab in px: positive moves it down, negative up. Pass the same value to both tabs of a pair to shift them together.
export default function LateralLeft({ children, target, label, positionIDX = 0, n = 1, offsetY = 0, positionClassName }: { children?: React.JSX.Element, target?: string, positionIDX?: number, n?: number, offsetY?: number, label?: string, positionClassName?: string }) {
    const compact = n === 2;
    const position = positionClassName ?? (compact ? DOUBLE_POSITIONS[positionIDX] ?? SINGLE_POSITION : SINGLE_POSITION);

    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    const [offsetRight, setOffsetRight] = useState(0);
    const [timerTouch, setTimerTouch] = useState<NodeJS.Timeout | null>(null);
    // drives the left transition: easing while dragging makes the tab lag behind the finger
    const [isDragging, setIsDragging] = useState(false);
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
        setIsDragging(false);
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
                const audio_ = new Audio("/audio/SFX_SWITCH.wav");
                audio_.volume = 0.02;
                audio_.play().catch(err => {
                    console.error("Error playing sound:", err);
                });
                router.push(target || '/');
            }, 500));
        }

        setOffsetRight(10);
        draggingRef.current = true;
        setIsDragging(true);
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
            const audio_ = new Audio("/audio/SFX_SWITCH.wav");
            audio_.volume = 0.02;
            audio_.play().catch(err => {
                console.error("Error playing sound:", err);
            });
            router.push(target || '/');
        }
    }, [offsetRight]);

    // 0 at rest → 1 at full pull; fades in the label as the tab is dragged out
    const reveal = Math.min(Math.max(offsetRight, 0) / 80, 1);

    return (
        // Positioning + shadow live on this wrapper: the pixel-corner clip-path on the
        // inner element would cut off any shadow drawn on the element itself.
        <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
                e.preventDefault()
                const audio_ = new Audio("/audio/SFX_SWITCH.wav");
                audio_.volume = 0.02;
                audio_.play().catch(err => {
                    console.error("Error playing sound:", err);
                });
                router.push(target || '/');
            }}
            aria-label={label ?? "Open"}
            role="button"
            style={{
                left: `${-120 + offsetRight}px`,
                position: 'absolute',
                transform: offsetY ? `translateY(${offsetY}px)` : undefined,
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'left 0.2s ease-out',
                // hard, offset pixel shadow + a soft one underneath for lift
                filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.35)) drop-shadow(0 8px 8px rgba(0,0,0,0.3))',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
            }}
            className={`group z-90 w-[160px] ${compact ? "h-[64px]" : "h-[96px]"} ${position}`}
        >
            <div
                style={{
                    // bevel baked into the background instead of a box-shadow: this element also has
                    // the pixel-corners clip-path, and a box-shadow is rasterized in a separate pass from
                    // the clip — at phone pixel ratios the two passes round clip-path's fractional
                    // coordinates slightly differently, leaving a hairline seam at the clipped edge.
                    // A background is clipped in the same pass, so it can't drift out of alignment.
                    background: [
                        "linear-gradient(to bottom, rgba(255,255,255,0.22) 0 2px, transparent 2px calc(100% - 2px), rgba(0,0,0,0.18) calc(100% - 2px))",
                        "linear-gradient(160deg, #e85d63, #c63f44 70%)",
                    ].join(", "),
                }}
                className='pixel-corners-8-border [--border-color:#9e4042] flex h-full w-full items-stretch transition-transform duration-150 group-hover:translate-x-1'
            >
                {/* never on screen: keeps the tab anchored while it slides.
                    39px leaves the handle 34px wide, so the 24px icon centres on whole pixels (5px each side) */}
                <div className='w-[39px] shrink-0' />

                {/* revealed while dragging */}
                <div
                    style={{ opacity: reveal }}
                    className='flex w-[80px] shrink-0 items-center justify-end gap-1.5 pr-2'
                >
                    {label && (
                        <span className='font-pokemon text-xs uppercase text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.35)]'>
                            {label}
                        </span>
                    )}
                    <svg width="8" height="14" viewBox="0 0 4 7" shapeRendering="crispEdges" className='shrink-0 text-white/90' aria-hidden>
                        <path d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z" fill="currentColor" />
                    </svg>
                </div>

                {/* one background instead of two borders: same reasoning as the bevel above — this keeps
                    the dark and light lines from drifting apart at the clipped edges */}
                <div className={`my-auto ${compact ? "h-[40px]" : "h-[64px]"} w-[3px] shrink-0 bg-[linear-gradient(to_right,#9e4042_0_2px,rgba(255,255,255,0.25)_2px_3px)]`} />

                {/* visible handle: icon at its native 24px grid, engraved like a grip (quiet, but still says what it does) */}
                <div className='flex flex-1 items-center justify-center'>
                    <div className='h-6 w-6 text-white/60 [&_svg]:[filter:drop-shadow(0_1px_0_rgba(0,0,0,0.25))]!'>{children}</div>
                </div>
            </div>
        </div>
    );
}
