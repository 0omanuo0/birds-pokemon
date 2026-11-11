"use client";

import { ImgHTMLAttributes, ReactNode, useState } from "react";

// <img> that swaps to a fallback (default: nothing, so the parent's background shows) when the file fails to load,
// instead of the browser's broken-image icon. A new src gets a fresh chance.
export default function SafeImg({
    fallback = null,
    src,
    ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { src?: string; fallback?: ReactNode }) {
    const [failed, setFailed] = useState<string | null>(null);
    if (!src || failed === src) return <>{fallback}</>;
    // eslint-disable-next-line @next/next/no-img-element -- remote, user and reference URLs of any host
    return <img {...rest} src={src} onError={() => setFailed(src)} />;
}
