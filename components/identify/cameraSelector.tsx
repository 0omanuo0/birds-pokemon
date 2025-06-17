"use client";
import { getGetUserMedia } from '@/app/identify/getUserMedia';
import React, { useEffect, useState, useRef } from 'react';
import { imageSvg, userSvg } from '../imageSvg';



export default function CameraSelector({
    videoRef,
    streamRef,
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    streamRef: React.RefObject<MediaStream | null>;
}) {
    const [selectedId, setSelectedId] = useState<string>('');
    const [options, setOptions] = useState<
        { id: string; label: string; isFacing: boolean }[]
    >([]);
    useEffect(() => {
        const init = async () => {
            // 1) Must be a secure context
            if (!window.isSecureContext) {
                console.error(
                    'Camera API only works in secure contexts (HTTPS or localhost).'
                );
                return;
            }

            const getUserMedia = getGetUserMedia();
            if (!getUserMedia) {
                console.error('No getUserMedia implementation found.');
                return;
            }

            // 2) Prompt once for permission so enumerateDevices() returns labels
            try {
                const pre = await getUserMedia({ video: true });
                streamRef.current = pre;
            } catch (err) {
                console.warn('User denied camera or error on initial access', err);
                // we can still try enumerateDevices, but labels might be empty
            }

            // 3) Try to enumerate device‐IDs
            let videoInputs: MediaDeviceInfo[] = [];
            if (
                navigator.mediaDevices &&
                typeof navigator.mediaDevices.enumerateDevices === 'function'
            ) {
                try {
                    const all = await navigator.mediaDevices.enumerateDevices();
                    videoInputs = all.filter((d) => d.kind === 'videoinput');
                } catch (err) {
                    console.warn('enumerateDevices() failed', err);
                }
            }

            if (videoInputs.length && videoInputs[0].deviceId) {
                // Real deviceId flow
                const opts = videoInputs.map((d) => ({
                    id: d.deviceId,
                    label: d.label || `Camera ${d.deviceId}`,
                    isFacing: false,
                }));
                console.log(opts);
                setOptions(opts);

                // If we have a saved camera ID, use it
                const savedId = localStorage.getItem('selectedCameraId');
                if (savedId && opts.some((o) => o.id === savedId)) {
                    setSelectedId(savedId);
                } else {
                    // Fallback to first available camera
                    setSelectedId(opts[0].id);
                }

            }
        };

        init();
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // whenever selectedId changes, (re)start the stream
    useEffect(() => {
        let isActive = true;

        async function startCamera() {
            if (!selectedId || !isActive) return;
            const getUserMedia = getGetUserMedia();
            if (!getUserMedia) return;

            // stop old
            streamRef.current?.getTracks().forEach((t) => t.stop());

            // find our option to see if it's a facingMode or deviceId
            const opt = options.find((o) => o.id === selectedId);
            if (!opt) return;

            const constraints: MediaStreamConstraints = {
                video: opt.isFacing
                    ? { facingMode: opt.id as 'user' | 'environment' }
                    : { deviceId: { exact: opt.id } },
            };

            try {
                const newStream = await getUserMedia(constraints);
                if (!isActive) {
                    newStream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = newStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
            } catch (err) {
                console.error('Error starting camera:', err);
            }
        }

        function handleVisibility() {
            if (document.hidden) {
                // Pause/stop video stream when tab is hidden
                streamRef.current?.getTracks().forEach((t) => t.stop());
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
            } else {
                // Restart camera when tab is focused again
                startCamera();
            }
        }

        document.addEventListener('visibilitychange', handleVisibility);

        startCamera();

        console.log(selectedId, options);

        return () => {
            isActive = false;
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [selectedId, options]);
    return (
        <div className="">
            {
                options.length > 1 &&
                (
                    <div className="flex flex-wrap w-full">
                        <button
                            className={
                                'backdrop-blur-sm pr-3 pl-8 py-1 transition-colors duration-300' +
                                (selectedId === options[0].id ? ' bg-red-500/60' : ' bg-neutral-700/60')
                            }
                            style={{
                                clipPath: "polygon(20% 0%, 100% 0, 100% 100%, 0% 100%)",
                            }}
                            onClick={() => setSelectedId(options[0].id)}
                        >#1</button>
                        <button
                            className={
                                'backdrop-blur-sm pr-8 pl-3 py-1 transition-colors duration-300' +
                                (selectedId === options[1].id ? ' bg-red-500/60' : ' bg-neutral-700/60')
                            }
                            style={{
                                clipPath: "polygon(0% 0%, 80% 0, 100% 100%, 0% 100%)",
                            }}
                            onClick={() => setSelectedId(options[1].id)}
                        >#2</button>
                    </div>
                )
            }
        </div>
    );
}