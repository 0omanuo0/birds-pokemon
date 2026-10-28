"use client";

import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { BirdInfo, DescriptionSection, TabKey } from "@/app/api/bird_info/route";
import IucnScale from "./iucnScale";

const TABS: { key: TabKey; label: string; aria: string }[] = [
    { key: "datos", label: "Datos", aria: "Datos" },
    { key: "area", label: "Área", aria: "Área de distribución" },
    { key: "vida", label: "Vida", aria: "Vida y comportamiento" },
    { key: "mas", label: "+", aria: "Más información" },
];

// horizontal swipe distance (px) that switches tab; must also be more horizontal than vertical
const SWIPE_PX = 50;

// sheet content height, collapsed / expanded
const COLLAPSED_PX = 200;
const EXPANDED_PX = 450;

// finger/pointer travel (px) before a press on the handle counts as a drag instead of a tap
const DRAG_PX = 4;
// vertical travel (px) of a swipe on the content that expands / collapses the sheet
const SWIPE_SHEET_PX = 12;

function hasTab(info: BirdInfo, tab: TabKey): boolean {
    switch (tab) {
        case "datos": return !!info.summary || info.taxonomy.length > 0 || !!info.status.code || !!info.status.image || info.tabs.datos.length > 0;
        case "area": return !!info.rangeMap || info.tabs.area.length > 0;
        default: return info.tabs[tab].length > 0;
    }
}

// Bodies can contain a <ul> (a paragraph ending in ":" keeps its list), so they render in a <div>, not a <p>.
// Tailwind's reset removes list bullets, so the lists get a pixel "▸" marker here.
const BODY_CLASS = "[&_ul]:mt-1.5 [&_ul]:mb-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-4 [&_ul]:list-['▸_'] [&_li]:marker:text-yellow-600";

// body/value HTML is built server-side from escaped text + <i>/<b>/<ul>/<li> only (app/api/bird_info)
function Sections({ sections }: { sections: DescriptionSection[] }) {
    if (sections.length === 0) return null;
    return (
        <div className="flex flex-col gap-4">
            {sections.map((section, index) => (
                <section key={index}>
                    {/* small pixel label with the banner's yellow tick instead of a big bold heading */}
                    <h3 className="mb-1 flex items-center gap-1.5 font-pokemon text-base uppercase tracking-wide text-neutral-500">
                        <span className="inline-block h-2.5 w-[2px] bg-yellow-500" aria-hidden />
                        {section.title}
                    </h3>
                    <div className={BODY_CLASS} dangerouslySetInnerHTML={{ __html: section.body }} />
                </section>
            ))}
        </div>
    );
}

// description: null while loading
export default function BirdDescription({ description }: { description: BirdInfo | null }) {

    const [height, setHeight] = useState(COLLAPSED_PX);
    const toggleHeight = () => setHeight(h => (h === COLLAPSED_PX ? EXPANDED_PX : COLLAPSED_PX));
    // live height while the handle is being dragged (null = not dragging, `height` rules)
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const shownHeight = dragHeight ?? height;
    const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);
    const heightRef = useRef(height);
    heightRef.current = height;
    const [tab, setTab] = useState<TabKey>("datos");
    const articleRef = useRef<HTMLElement>(null);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

    // Scrolling the content while the sheet is collapsed expands it first instead of scrolling the text, and
    // scrolling back up from the top of the text collapses it. Wheel and touch need native, non-passive
    // listeners: React's synthetic ones can't preventDefault the scroll.
    useEffect(() => {
        const el = articleRef.current;
        if (!el) return;
        let startY = 0;
        let startX = 0;
        let handled = false;

        const onWheel = (e: globalThis.WheelEvent) => {
            if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // horizontal wheel: leave it
            if (heightRef.current === COLLAPSED_PX && e.deltaY > 0) {
                e.preventDefault();
                setHeight(EXPANDED_PX);
            } else if (heightRef.current === EXPANDED_PX && e.deltaY < 0 && el.scrollTop <= 0) {
                e.preventDefault();
                setHeight(COLLAPSED_PX);
            }
        };
        const onTouchStart = (e: globalThis.TouchEvent) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            handled = false;
        };
        const onTouchMove = (e: globalThis.TouchEvent) => {
            if (handled) {
                // the gesture already resized the sheet: don't let the rest of it scroll the text
                if (e.cancelable) e.preventDefault();
                return;
            }
            const dy = e.touches[0].clientY - startY;
            const dx = e.touches[0].clientX - startX;
            if (Math.abs(dy) < SWIPE_SHEET_PX || Math.abs(dy) < Math.abs(dx)) return;
            if (heightRef.current === COLLAPSED_PX && dy < 0) {
                handled = true;
                setHeight(EXPANDED_PX);
            } else if (heightRef.current === EXPANDED_PX && dy > 0 && el.scrollTop <= 0) {
                handled = true;
                setHeight(COLLAPSED_PX);
            } else {
                return;
            }
            if (e.cancelable) e.preventDefault();
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
        };
    }, []);

    // dragging the handle: the sheet follows the pointer, then snaps to the nearer end on release;
    // a press that barely moves is a tap and toggles
    function onHandleDown(e: PointerEvent<HTMLButtonElement>) {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, from: height, moved: false };
    }
    function onHandleMove(e: PointerEvent<HTMLButtonElement>) {
        const d = drag.current;
        if (!d) return;
        const delta = d.y - e.clientY; // dragging up grows the sheet
        if (!d.moved && Math.abs(delta) < DRAG_PX) return;
        d.moved = true;
        setDragHeight(Math.max(COLLAPSED_PX, Math.min(EXPANDED_PX, d.from + delta)));
    }
    function onHandleUp(e: PointerEvent<HTMLButtonElement>) {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) {
            setDragHeight(null);
            toggleHeight();
            return;
        }
        const delta = d.y - e.clientY;
        const live = Math.max(COLLAPSED_PX, Math.min(EXPANDED_PX, d.from + delta));
        setHeight(live > (COLLAPSED_PX + EXPANDED_PX) / 2 ? EXPANDED_PX : COLLAPSED_PX);
        setDragHeight(null);
    }

    const available = description ? TABS.filter(t => hasTab(description, t.key)) : [];
    const activeTab = available.some(t => t.key === tab) ? tab : available[0]?.key;

    // a new bird starts on its first tab
    useEffect(() => {
        setTab("datos");
    }, [description]);

    function selectTab(next: TabKey) {
        setTab(next);
        if (articleRef.current) articleRef.current.scrollTop = 0;
    }

    function onTouchEnd(e: TouchEvent) {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || !activeTab) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
        const index = available.findIndex(t => t.key === activeTab);
        const next = available[index + (dx < 0 ? 1 : -1)];
        if (next) selectTab(next.key);
    }

    return (
        // Unclipped wrapper: the sheet below has a pixel-corners clip-path, which also clips hit-testing,
        // so the enlarged touch target has to live out here to reach above the sheet's top edge.
        <div
            className="absolute -bottom-[28px] left-0 right-0 mx-2 w-[calc(100%-16px)]"
            style={{ "--desc-height": `${shownHeight}px` } as React.CSSProperties}
        >
            {/* invisible finger-sized expand/collapse target centred on the handle bar: 16px above the sheet
                down to 20px into it, which stops before the tab buttons (they start ~20px in). Tap toggles,
                dragging up/down resizes (touch-none so the browser doesn't take the drag as a page scroll). */}
            <button
                type="button"
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                // keyboard activation only: pointer taps are handled on pointerup
                onClick={(e) => { if (e.detail === 0) toggleHeight(); }}
                aria-label={height === COLLAPSED_PX ? "Expand description" : "Collapse description"}
                aria-expanded={height !== COLLAPSED_PX}
                className="absolute inset-x-0 -top-4 z-20 h-9 cursor-grab touch-none active:cursor-grabbing"
            />
        <div className={`description-size px-2 pixel-corners-10`}
            style={{
                backgroundImage: "linear-gradient(-45deg, #222 30%, #333 60%, #222 70%)",
                transition: dragHeight === null ? "height 0.3s ease-in-out" : "none",
            }}
        >
            {/* visual handle only; the hit area is the button above */}
            <div className="flex h-3 w-full items-center justify-center" aria-hidden>
                <span className="block h-[2px] w-[180px] bg-neutral-300" />
            </div>
            <article
                ref={articleRef}
                className={`bg-white description-size-article overflow-y-scroll pixel-corners-6 `}
                style={{
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                    // no easing while the finger is on the handle, or the sheet would lag behind it
                    transition: dragHeight === null ? "height 0.3s ease-in-out" : "none",
                }}
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div className="scrollable-pattern min-h-[var(--desc-height)]">
                    {/* dex tab strip, stays visible while the tab content scrolls */}
                    {available.length > 0 && (
                        <div role="tablist" className="sticky top-0 z-10 flex gap-1.5 border-b-2 border-neutral-800 bg-white px-2 pb-1.5 pt-2">
                            {available.map(t => {
                                const active = t.key === activeTab;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        aria-label={t.aria}
                                        onClick={() => selectTab(t.key)}
                                        className={`pixel-corners-4 h-8 min-w-10 flex-1 cursor-pointer touch-manipulation px-2 font-pokemon text-sm uppercase leading-none transition-colors ${active ? "bg-yellow-400 text-neutral-900" : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"}`}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div
                        role="tabpanel"
                        className="text-sm text-neutral-800 px-3 pt-3 leading-relaxed pb-8 mb-6"
                        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
                        onTouchEnd={onTouchEnd}
                    >
                        {description === null ? (
                            <div className="flex flex-col gap-2 pt-1" aria-label="Loading description">
                                {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((width, i) => (
                                    <div key={i} className={`h-3 animate-pulse bg-neutral-300 ${width}`} />
                                ))}
                            </div>
                        ) : !activeTab ? (
                            <p className="text-neutral-500">No description available.</p>
                        ) : activeTab === "datos" ? (
                            <div className="flex flex-col gap-4">
                                {description.summary && <div className={BODY_CLASS} dangerouslySetInnerHTML={{ __html: description.summary }} />}
                                {description.taxonomy.length > 0 && (
                                    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-y border-neutral-300 py-2">
                                        {description.taxonomy.map(row => (
                                            <div key={row.label} className="contents">
                                                <dt className="font-pokemon text-xs uppercase text-neutral-500">{row.label}</dt>
                                                <dd dangerouslySetInnerHTML={{ __html: row.value }} />
                                            </div>
                                        ))}
                                    </dl>
                                )}
                                <IucnScale status={description.status} />
                                <Sections sections={description.tabs.datos} />
                            </div>
                        ) : activeTab === "area" ? (
                            <div className="flex flex-col gap-4">
                                {description.rangeMap && (
                                    // only mounted while ÁREA is open, and lazy on top of that
                                    <div className="pixel-corners-4 bg-neutral-200 p-1">
                                        <img
                                            src={description.rangeMap.src}
                                            srcSet={description.rangeMap.srcSet}
                                            width={description.rangeMap.width}
                                            height={description.rangeMap.height}
                                            alt="Mapa de distribución"
                                            loading="lazy"
                                            decoding="async"
                                            className="block h-auto w-full bg-white"
                                        />
                                    </div>
                                )}
                                <Sections sections={description.tabs.area} />
                            </div>
                        ) : (
                            <Sections sections={description.tabs[activeTab]} />
                        )}
                    </div>
                </div>
            </article>
        </div>
        </div>
    );
}
