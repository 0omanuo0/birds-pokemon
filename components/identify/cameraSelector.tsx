"use client";
import { getGetUserMedia } from '@/app/identify/getUserMedia';
import React, { useEffect, useState, useRef } from 'react';
import { imageSvg, userSvg } from '../imageSvg';



// what the camera is doing, so the preview can show a placeholder instead of a blank video
export type CameraStatus = 'starting' | 'denied' | 'unsupported' | 'error' | 'off';

export default function CameraSelector({
    videoRef,
    streamRef,
    active = true,
    onStatus,
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    streamRef: React.RefObject<MediaStream | null>;
    // false releases the camera (tracks stopped, sensor off); true starts it again
    active?: boolean;
    onStatus?: (status: CameraStatus) => void;
}) {
    const [selectedId, setSelectedId] = useState<string>('');
    const [options, setOptions] = useState<
        { id: string; label: string; isFacing: boolean }[]
    >([]);

    const [savedId, _] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('selected_camera_id') || '';
        }
        return '';
    });

    useEffect(() => {
        const init = async () => {
            // 1) Must be a secure context
            if (!window.isSecureContext) {
                console.error(
                    'Camera API only works in secure contexts (HTTPS or localhost).'
                );
                onStatus?.('unsupported');
                return;
            }

            const getUserMedia = getGetUserMedia();
            if (!getUserMedia) {
                console.error('No getUserMedia implementation found.');
                onStatus?.('unsupported');
                return;
            }

            // 2) Prompt once for permission so enumerateDevices() returns labels
            try {
                const pre = await getUserMedia({ video: true });
                streamRef.current = pre;
            } catch (err) {
                console.warn('User denied camera or error on initial access', err);
                const name = (err as DOMException | undefined)?.name;
                onStatus?.(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
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

                setOptions(opts);

                // If we have a saved camera ID, use it
                if (savedId && opts.some((o) => o.id === savedId)) {
                    setSelectedId(savedId);
                } else {
                    // Fallback to the second camera (the back one on phones), or the only one there is
                    setSelectedId((opts[1] ?? opts[0]).id);
                }

            } else if (streamRef.current && videoRef.current) {
                // no usable device ids: just show the stream from the permission prompt
                videoRef.current.srcObject = streamRef.current;
            }
        };

        init();
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // whenever selectedId changes, (re)start the stream; when inactive, release the camera entirely.
    // Stopping the tracks is what actually turns the sensor off — track.enabled = false or pausing the
    // <video> keeps the camera pipeline running (and the phone heating) on Android.
    useEffect(() => {
        if (!active) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            onStatus?.('off');
            return;
        }

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

            onStatus?.('starting');
            const constraints: MediaStreamConstraints = {
                video: {
                    ...(opt.isFacing
                        ? { facingMode: opt.id as 'user' | 'environment' }
                        : { deviceId: { exact: opt.id } }),
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 },
                },
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
                if (isActive) {
                    onStatus?.((err as DOMException | undefined)?.name === 'NotAllowedError' ? 'denied' : 'error');
                }
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
        // save in localStorage
        localStorage.setItem('selected_camera_id', selectedId);

        return () => {
            isActive = false;
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [selectedId, options, active]);


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