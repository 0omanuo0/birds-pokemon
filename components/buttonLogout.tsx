"use client"

import { signOut } from "next-auth/react"


export default function ButtonLogout() {
    return (
        <button
            onClick={() => {
                signOut()
            }}
            style={{
                clipPath: "polygon(15% 0, 85% 0, 100% 70%, 100% 100%, 0 100%, 0 70%)",
                background: "linear-gradient(160deg, #e85d63, #c63f44 50%)"
            }}
            className="bg-red-400 text-white text-xl tracking-wider pt-2 font-pokemon px-4 py-1 w-30 shadow-md hover:bg-red-500 transition-colors cursor-pointer"
        >
            <svg
                className='absolute top-0 left-0 h-[96px] w-[120px] pointer-events-none'
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                <polygon
                    points="15,0 85,0 100,70 100,100 0,100 0,70"
                    fill="transparent"
                    stroke="#404040aa"
                    strokeWidth="3"
                />
            </svg>
            Logout
        </button>
    )
}