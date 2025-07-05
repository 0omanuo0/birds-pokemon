'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getGetUserMedia } from './getUserMedia';
import CameraComponent from '@/components/identify/camera';
import CameraSelector from '@/components/identify/cameraSelector';
import PokeballRotation from '@/components/pokeballRotation';
import ContextMenu from '@/components/contextMenu';
import { arrowBoxLeftSvg, CameraSvg, homeSvg, ImageAddSvg, userSvg } from '@/components/imageSvg';
import LateralRight from '@/components/nav/lateralRight';
import LateralLeft from '@/components/nav/lateralLeft';
import Dialog from '@/components/identify/dialog';
import Noise from '@/components/turbulenceNoise';

// A small helper to grab the best getUserMedia implementation


export default function IdentifyPage() {


    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [showDialog, setShowDialog] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [image, setImage] = useState<Blob | null>(null);

    function predict() {
        if (!videoRef.current || !streamRef.current) {
            console.error('Video element or stream not available');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
            return;
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');
            setImage(blob); // Store the image blob for dialog display
            console.log('Sending image for prediction:', blob.size);
            try {
                const response = await fetch('/api/identify', {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    console.error('Failed to fetch prediction:', response.statusText);
                    return;
                }
                const data = await response.json();
                console.log('Prediction result:', data);
                setResult(data);
                setShowDialog(true);

                // draw the predicted bird image on the canvas
                const birdCanvas = document.getElementById('birdCanvas') as HTMLCanvasElement;
                const birdCtx = birdCanvas.getContext('2d');
                if (birdCtx && videoRef.current) {
                    birdCtx.clearRect(0, 0, birdCanvas.width, birdCanvas.height);
                    birdCtx.drawImage(videoRef.current, 0, 0, birdCanvas.width, birdCanvas.height);
                }
            } catch (error) {
                console.error('Error during prediction:', error);
                setShowDialog(false);
            }
        }, 'image/jpeg');
    }



    const contextMenuRef = useRef<any>(null);



    return (
        <div className='h-[100dvh] md:py-4 2xl:py-8 w-full'
            style={{
                backgroundImage: "linear-gradient(45deg,#0000 10%, #222 60%)",
            }}
        >

            <div className='md:w-[420px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700 '>
                <main
                    className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
                >

                    <LateralLeft target='/identify'>{userSvg}</LateralLeft>
                    <LateralRight target='/'>{homeSvg}</LateralRight>
                    <section className="relative w-full h-fit md:h-[450px]">
                        <div className="h-full w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
                            <Noise />
                            <nav className="flex flex-row justify-between items-center w-full my-2 h-8">
                                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                                <span className="text-neutral-300 text-sm font-medium font-pokemon">Birds Pokedex</span>
                            </nav>
                            <div
                                className="w-full md:h-full h-[50dvh] bg-neutral-700 rounded-sm relative overflow-hidden noise-effect shining"
                            >
                                <div className="flex flex-row w-full h-full relative">
                                    <CameraComponent
                                        videoRef={videoRef}
                                        streamRef={streamRef}
                                    />
                                    <Dialog showDialog={showDialog} image={image} setShowDialog={setShowDialog} result={result} />
                                </div>

                                <div className={"absolute bottom-0 right-0 w-fit h-16 m-4  flex items-end justify-center" + (showDialog ? " hidden" : "")}>
                                    <button
                                        onClick={() => {
                                            // upload photo, first show dialog to select file and then upload
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/jpg,image/jpeg';
                                            input.onchange = async (event) => {
                                                const file = (event.target as HTMLInputElement).files?.[0];
                                                if (!file) return;

                                                const formData = new FormData();
                                                formData.append('image', file);
                                                setImage(file); // Store the image blob for dialog display
                                                console.log('Sending image for prediction:', file.size);

                                                try {
                                                    const response = await fetch('/api/identify', {
                                                        method: 'POST',
                                                        body: formData,
                                                    });
                                                    if (!response.ok) {
                                                        alert('Failed to fetch prediction: ' + response.statusText);
                                                        console.error('Failed to fetch prediction:', response.statusText);
                                                        return;
                                                    }
                                                    const data = await response.json();
                                                    console.log('Prediction result:', data);
                                                    setResult(data);
                                                    setShowDialog(true);
                                                    const birdCanvas = document.getElementById('birdCanvas') as HTMLCanvasElement;
                                                    const birdCtx = birdCanvas.getContext('2d');
                                                    if (birdCtx) {
                                                        const image = new Image();
                                                        image.src = URL.createObjectURL(file);
                                                        image.onload = () => {
                                                            birdCtx.clearRect(0, 0, birdCanvas.width, birdCanvas.height);

                                                            // Calculate aspect ratios
                                                            const canvasAspect = birdCanvas.width / birdCanvas.height;
                                                            const imageAspect = image.width / image.height;

                                                            let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;

                                                            if (imageAspect > canvasAspect) {
                                                                // Image is wider: crop sides
                                                                sWidth = image.height * canvasAspect;
                                                                sx = (image.width - sWidth) / 2;
                                                            } else {
                                                                // Image is taller: crop top/bottom
                                                                sHeight = image.width / canvasAspect;
                                                                sy = (image.height - sHeight) / 2;
                                                            }

                                                            birdCtx.drawImage(
                                                                image,
                                                                sx, sy, sWidth, sHeight,
                                                                0, 0, birdCanvas.width, birdCanvas.height
                                                            );
                                                        };
                                                    }
                                                } catch (error) {
                                                    console.error('Error during prediction:', error);
                                                }
                                            }
                                            input.click();
                                        }}
                                        className="w-10 h-10 px-1 py-1 z-[99] bg-red-400 border-2 border-neutral-700/70">{ImageAddSvg}</button>
                                </div>

                                <div
                                    className="absolute inset-0 pointer-events-none rounded-sm"
                                    style={{ boxShadow: "inset 0 0 6px 1px #171717" }}
                                />
                            </div>
                        </div>
                    </section>
                    <PokeballRotation
                        onWheel={() => { }}
                        startScroll={0}
                        endScroll={0}
                        onPress={() => {
                            predict();
                        }}
                        onLongPress={() => { }}

                    />
                    <ContextMenu ref={contextMenuRef} />

                </main>
            </div>
        </div>
    );
}


