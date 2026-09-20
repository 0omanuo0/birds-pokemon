"use client";

import { ReactNode, useEffect } from "react";

export type DexNoticeAction = { label: string; onClick: () => void; primary?: boolean };

// Pokédex-style modal that replaces window.alert. Renders inside the nearest positioned ancestor
// (the device screen), so it stays in the device frame instead of covering the whole page.
export default function DexNotice({ open, tone = "info", title, children, actions, onClose }: {
    open: boolean;
    tone?: "info" | "success" | "error";
    title: string;
    children?: ReactNode;
    actions: DexNoticeAction[];
    onClose?: () => void;
}) {
    useEffect(() => {
        if (!open || !onClose) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const tick = tone === "error" ? "bg-red-400" : tone === "success" ? "bg-green-400" : "bg-yellow-400";

    return (
        <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 animate-[device-screen-in_150ms_ease-out]"
            onClick={onClose}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
                onClick={e => e.stopPropagation()}
                className="pixel-corners-10 w-full max-w-[300px] bg-gradient-to-br from-neutral-700 to-neutral-500 p-1.5 shadow-lg"
            >
                <div className="pixel-corners-6 bg-neutral-900 text-neutral-100">
                    {/* notched banner, same shape as the dex head card */}
                    <div className="bg-white pb-[3px]">
                        <h2
                            style={{ clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)" }}
                            className="relative flex items-center gap-2 bg-neutral-700 px-3 py-1.5 font-pokemon text-sm uppercase"
                        >
                            <span className={`inline-block h-3 w-[3px] ${tick}`} aria-hidden />
                            {title}
                            <span className="absolute bottom-0 left-0 h-px w-[70%] bg-yellow-400" aria-hidden />
                        </h2>
                    </div>

                    <div className="px-4 py-4 text-sm leading-relaxed text-neutral-200">{children}</div>

                    <div className="flex gap-2 px-3 pb-3">
                        {actions.map(action => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                className={`pixel-corners-4 h-9 flex-1 cursor-pointer touch-manipulation font-pokemon text-sm uppercase transition-colors ${action.primary ? "bg-yellow-400 text-neutral-900 hover:bg-yellow-300" : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"}`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
