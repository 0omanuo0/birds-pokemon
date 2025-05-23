"use client";

import { useImperativeHandle, useState } from "react";
import ButtonContext from "./buttonContext";




export default function ContextMenu({ ref }: { ref: any }) {
    const [contextMenu, setContextMenu] = useState(false);

    useImperativeHandle(ref, () => ({
        toggleContextMenu: () => {
            setContextMenu((prev) => !prev);
        },
    }));


    return (
        <section
            // context menu
            style={{
                left: "50%", zIndex: 100, bottom: "0px",
                transform: contextMenu ? "translate(-50%, 20%)" : "translate(-50%, 200%)",
                transition: "transform 0.3s ease-in-out",
            }}
            className="absolute overflow-hidden w-full pointer-events-none flex items-end justify-between my-10 py-10 px-20"
        >
            <ButtonContext
                href="/add"
                bgcolor="bg-emerald-300">
                <svg
                    style={{
                        filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                        color: "#ddd"
                    }}
                    fill="none"
                    className="w-6 h-6 -ml-[3px] -mt-[2px]"
                >
                    <path d="M15 2H9v2H7v6h2V4h6V2zm0 8H9v2h6v-2zm0-6h2v6h-2V4zM4 16h2v-2h12v2H6v4h12v-4h2v6H4v-6z" fill="currentColor" />
                </svg>
            </ButtonContext>
            <ButtonContext bgcolor="bg-rose-300">
                <svg
                    style={{
                        filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                        color: "#ddd"
                    }}
                    fill="none"
                    className="w-6 h-6 -ml-[3px] -mt-[2px]"
                >
                    <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zm-6-8h4v2h-4v4h-2v-4H7v-2h4V7h2v4z" fill="currentColor" />
                </svg>
            </ButtonContext>

            <ButtonContext bgcolor="bg-sky-300">
                <svg
                    style={{
                        filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                        color: "#ddd"
                    }}
                    fill="none"
                    className="w-6 h-6 -ml-[3px] -mt-[3px]"
                >
                    <path d="M18 2h-2v2h2V2zM4 4h6v2H4v14h14v-6h2v8H2V4h2zm4 8H6v6h6v-2h2v-2h-2v2H8v-4zm4-2h-2v2H8v-2h2V8h2V6h2v2h-2v2zm2-6h2v2h-2V4zm4 0h2v2h2v2h-2v2h-2v2h-2v-2h2V8h2V6h-2V4zm-4 8h2v2h-2v-2z" fill="currentColor" />
                </svg>
            </ButtonContext>

        </section>
    )
}