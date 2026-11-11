'use client';

import React, { useEffect, useRef, useState } from 'react';
import Viewfinder from '@/components/identify/viewfinder';
import AddPhotoDialog from '@/components/identify/addPhotoDialog';
import { useCamera } from '@/lib/useCamera';
import PokeballRotation, { type PokeballRotationHandle } from '@/components/pokeballRotation';
import { burgerSvg, homeSvg } from '@/components/imageSvg';
import LateralRight from '@/components/nav/lateralRight';
import LateralLeft from '@/components/nav/lateralLeft';
import IdentifyResult from '@/components/identify/identifyResult';
import DexNotice from '@/components/ui/dexNotice';
import { DeviceHintsSetter } from '@/components/device/deviceContext';
import DeviceScreen, { DeviceControls } from '@/components/device/deviceScreen';
import { useUser } from '@/components/userContext';
import { resizeToJpeg } from '@/lib/resizeImage';
import { captureStill } from '@/lib/camera';
import type { IdentifyCandidate, IdentifyError, IdentifyResponse } from '@/app/api/identify/route';

// degrees of the pokeball per zoom step
const WHEEL_STEP = 45;

type Phase ='idle' | 'analyzing' | 'result' | 'error';
type ErrorKind = IdentifyError['error'] | 'network' | 'camera';

const ERROR_TEXT: Record<ErrorKind, { title: string; message: string }> = {
    backend: { title: 'Offline', message: "Couldn't reach the identifier. Try again in a few seconds." },
    no_bird: { title: 'No results', message: 'No bird was detected in the photo. Try getting closer or framing it better.' },
    no_image: { title: 'Invalid photo', message: "The photo couldn't be read. Try another image." },
    unauthorized: { title: 'Signed out', message: 'Your session has expired. Sign in again to identify birds.' },
    network: { title: 'Network error', message: "The photo couldn't be sent. Check your connection." },
    camera: { title: 'Camera', message: "The camera isn't ready yet." },
};

export default function IdentifyPage() {
    const { user } = useUser();
    const [phase, setPhase] = useState<Phase>('idle');
    const [adding, setAdding] = useState(false);
    const [capture, setCapture] = useState<{ blob: Blob; url: string } | null>(null);
    const [candidates, setCandidates] = useState<IdentifyCandidate[]>([]);
    const [error, setError] = useState<ErrorKind>('backend');

    // Release the camera while the result or an error covers it (saves CPU, battery and heat).
    // It restarts when back to idle; permission is already granted, so no prompt, just a short restart.
    const cameraActive = phase !== 'result' && phase !== 'error';
    // the camera, its zoom and its list of lenses (lib/useCamera.ts)
    const camera = useCamera(cameraActive);
    const { videoRef, streamRef, zoom } = camera;
    // CSS zoom only where the camera can't zoom itself; the photo is cropped the same way
    const cssZoom = zoom.hardware ? 1 : zoom.value;

    // The pokeball is the zoom dial: WHEEL_STEP degrees per zoom step. It turns freely (it stays wherever it is let go, so any
    // zoom in between is fine), and tapping a step on screen turns it there. In between, the zoom is interpolated between the
    // two neighbouring steps; the step lit on screen is the nearest one.
    const wheelRef = useRef<PokeballRotationHandle>(null);
    const steps = zoom.steps;
    const zoomAt = (rotation: number) => {
        const pos = Math.max(0, rotation / WHEEL_STEP);
        const i = Math.min(Math.floor(pos), steps.length - 1);
        const next = steps[Math.min(i + 1, steps.length - 1)];
        return steps[i] + (next - steps[i]) * (pos - i);
    };
    // the camera loads after the page and brings its own steps (x0.5 ... x10): put the dial on the step the zoom is at
    const stepsKey = steps.join(',');
    useEffect(() => {
        let best = 0;
        steps.forEach((s, i) => { if (Math.abs(s - zoom.value) < Math.abs(steps[best] - zoom.value)) best = i; });
        wheelRef.current?.rotateTo(best * WHEEL_STEP);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepsKey, camera.ready]);

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

            // the server gives the backend 20 s; without a limit here a dropped connection left "analyzing" forever
            const response = await fetch('/api/identify', { method: 'POST', body: formData, signal: AbortSignal.timeout(30_000) });
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

    function predict() {
        const video = videoRef.current;
        if (!video || !streamRef.current || !video.videoWidth) {
            setError('camera');
            setPhase('error');
            return;
        }
        // a full-size still from the sensor where the browser allows it, cropped to what the preview showed;
        // anything going wrong there falls back to the plain frame grab this page always used
        const track = streamRef.current.getVideoTracks()[0];
        captureStill(video, track, cssZoom).catch(() => null).then(blob => {
            if (blob) { identify(blob); return; }
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(b => { if (b) identify(b); }, 'image/jpeg', 0.92);
        });
    }

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return (
        <>
            <DeviceScreen>
                {/* camera, mode switch, camera switch, add-photo and zoom rail: components/identify/viewfinder.tsx */}
                <Viewfinder
                    camera={camera}
                    onAddPhoto={() => { if (phase === 'idle') setAdding(true); }}
                    onZoomStep={i => wheelRef.current?.animateTo(i * WHEEL_STEP)}
                />

                <AddPhotoDialog open={adding && phase === 'idle'} onClose={() => setAdding(false)} onFile={identify} />

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
                <LateralLeft target='/' label="Home">{homeSvg}</LateralLeft>
                <LateralRight target='/pokedex' label="Pokedex">{burgerSvg}</LateralRight>
                {/* labelled for this page's pokeball: press identifies, spinning zooms, hold does nothing here */}
                <DeviceHintsSetter press="Scan" hold={null} more={[{ symbol: "↻", verb: "Spin", label: "Zoom" }]} />
                <PokeballRotation
                    ref={wheelRef}
                    onWheel={e => { if (e >= 0) zoom.set(zoomAt(e)); }}
                    startScroll={0}
                    endScroll={Math.max(0, (steps.length - 1) * WHEEL_STEP)}
                    onPress={() => {
                        if (phase === 'idle') predict();
                    }}
                    onLongPress={() => { }}
                />
            </DeviceControls>
            
        </>
    );
}
