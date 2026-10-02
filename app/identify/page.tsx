'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CameraComponent from '@/components/identify/camera';
import PokeballRotation from '@/components/pokeballRotation';
import { homeSvg, ImageAddSvg, MicSvg, userSvg } from '@/components/imageSvg';
import LateralRight from '@/components/nav/lateralRight';
import LateralLeft from '@/components/nav/lateralLeft';
import IdentifyResult from '@/components/identify/identifyResult';
import DexNotice from '@/components/ui/dexNotice';
import DeviceScreen, { DeviceControls } from '@/components/device/deviceScreen';
import { useUser } from '@/components/userContext';
import { resizeToJpeg } from '@/lib/resizeImage';
import type { IdentifyCandidate, IdentifyError, IdentifyResponse } from '@/app/api/identify/route';

type Phase = 'idle' | 'analyzing' | 'result' | 'error';
type ErrorKind = IdentifyError['error'] | 'network' | 'camera';

const ERROR_TEXT: Record<ErrorKind, { title: string; message: string }> = {
    backend: { title: 'Offline', message: "Couldn't reach the identifier. Try again in a few seconds." },
    no_bird: { title: 'No results', message: 'No bird was detected in the photo. Try getting closer or framing it better.' },
    no_image: { title: 'Invalid photo', message: "The photo couldn't be read. Try another image." },
    network: { title: 'Network error', message: "The photo couldn't be sent. Check your connection." },
    camera: { title: 'Camera', message: "The camera isn't ready yet." },
};

export default function IdentifyPage() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const { user } = useUser();
    const router = useRouter();

    const [scale, setScale] = useState(1);
    const [phase, setPhase] = useState<Phase>('idle');
    const [capture, setCapture] = useState<{ blob: Blob; url: string } | null>(null);
    const [candidates, setCandidates] = useState<IdentifyCandidate[]>([]);
    const [error, setError] = useState<ErrorKind>('backend');

    // Release the camera while the result or an error covers it (saves CPU, battery and heat).
    // It restarts when back to idle; permission is already granted, so no prompt, just a short restart.
    const cameraActive = phase !== 'result' && phase !== 'error';

    // free the photo's object URL when it's replaced or the page unmounts
    useEffect(() => () => { if (capture) URL.revokeObjectURL(capture.url); }, [capture]);

    async function identify(blob: Blob) {
        if (phase === 'analyzing') return;
        setCapture({ blob, url: URL.createObjectURL(blob) });
        setPhase('analyzing');

        try {
            // the model only needs a small image; the full-size blob is kept for saving
            const small = await resizeToJpeg(blob);
            const formData = new FormData();
            formData.append('image', small, 'photo.jpg');

            const response = await fetch('/api/identify', { method: 'POST', body: formData });
            const data: IdentifyResponse | IdentifyError | null = await response.json().catch(() => null);

            if (!response.ok || !data || 'error' in data || data.candidates.length === 0) {
                setError(data && 'error' in data ? data.error : 'backend');
                setPhase('error');
                return;
            }
            setCandidates(data.candidates);
            setPhase('result');
        } catch (err) {
            console.error('Error during prediction:', err);
            setError('network');
            setPhase('error');
        }
    }

    function reset() {
        setPhase('idle');
        setCandidates([]);
        setCapture(null);
    }

    function uploadPhoto() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = event => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) identify(file);
        };
        input.click();
    }

    function predict() {
        const video = videoRef.current;
        if (!video || !streamRef.current || !video.videoWidth) {
            setError('camera');
            setPhase('error');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => { if (blob) identify(blob); }, 'image/jpeg', 0.92);
    }

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return (
        <>
            <DeviceScreen>
                <div className="relative flex h-full w-full flex-row">
                    <CameraComponent videoRef={videoRef} streamRef={streamRef} scale={scale} active={cameraActive} />
                </div>

                {phase === 'idle' && (
                    <div className="absolute bottom-0 right-0 m-4 flex h-16 w-fit items-end justify-center gap-2">
                        {/* the other half of identify: same flow, ears instead of eyes */}
                        <button
                            onClick={() => router.push('/identify-sound')}
                            aria-label="Identify by sound"
                            className="z-[30] h-10 w-10 cursor-pointer border-2 border-neutral-700/70 bg-red-400 px-1 py-1"
                        >
                            {MicSvg}
                        </button>
                        <button
                            onClick={uploadPhoto}
                            aria-label="Upload photo"
                            className="z-[30] h-10 w-10 cursor-pointer border-2 border-neutral-700/70 bg-red-400 px-1 py-1"
                        >
                            {ImageAddSvg}
                        </button>
                    </div>
                )}

                {/* analyzing: show the captured photo with a scan line while the model works */}
                {phase === 'analyzing' && capture && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-neutral-900/90 animate-[device-screen-in_150ms_ease-out]">
                        <div className="pixel-corners-6 relative aspect-square w-3/5 max-w-[240px] overflow-hidden bg-neutral-700 p-1">
                            <img src={capture.url} alt="" className="pixel-corners-4 h-full w-full object-cover" />
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-[dex-scan_1.4s_ease-in-out_infinite_alternate] border-b-2 border-yellow-400 bg-gradient-to-b from-transparent to-yellow-400/25" aria-hidden />
                        </div>
                        <p className="font-pokemon text-sm uppercase tracking-widest text-neutral-200">
                            Analyzing<span className="animate-pulse">…</span>
                        </p>
                    </div>
                )}

                {phase === 'result' && capture && (
                    <IdentifyResult
                        candidates={candidates}
                        photoUrl={capture.url}
                        image={capture.blob}
                        userId={user?.user_id}
                        onClose={reset}
                    />
                )}

                <DexNotice
                    open={phase === 'error'}
                    tone="error"
                    title={ERROR_TEXT[error].title}
                    onClose={reset}
                    actions={[
                        { label: 'Close', onClick: reset },
                        ...(capture && error !== 'camera'
                            ? [{ label: 'Retry', primary: true, onClick: () => { const blob = capture.blob; setPhase('idle'); identify(blob); } }]
                            : []),
                    ]}
                >
                    {ERROR_TEXT[error].message}
                </DexNotice>
            </DeviceScreen>
            
            <DeviceControls>
                <LateralLeft target='/user' label="User">{userSvg}</LateralLeft>
                <LateralRight target='/' label="Home">{homeSvg}</LateralRight>
                {/* same legend as Home, labelled for this page's pokeball: press identifies, spinning zooms */}
                <div className="font-pokemon-ns text-lg text-neutral-400 flex gap-6 my-2 shrink-0">
                    <span><span>◉</span>Press · <b className="text-amber-400">SCAN</b></span>
                    <span><span>↻</span>Spin · <b className="text-amber-400">ZOOM</b></span>
                </div>
                <PokeballRotation
                    onWheel={(e) => {
                        if (e < 0) return;
                        setScale(e / 32 + 1);
                    }}
                    startScroll={0}
                    endScroll={32 * 4}
                    onPress={() => {
                        if (phase === 'idle') predict();
                    }}
                    onLongPress={() => { }}
                />
            </DeviceControls>
            
        </>
    );
}
