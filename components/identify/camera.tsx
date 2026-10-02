"use client";

import { useState } from "react";
import { ImageAddSvg } from "../imageSvg";
import CameraSelector from "./cameraSelector";




export default function CameraComponent(
    {
        videoRef,
        streamRef,
        scale,
        active = true,
    }: {
        videoRef: React.RefObject<HTMLVideoElement | null>;
        streamRef: React.RefObject<MediaStream | null>;
        scale: number;
        active?: boolean;
    }) {


    return (
        <div style={{ position: 'relative', height: "100%", width: "100%" }} >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width={1920}
                height={1080}
                style={{
                    borderRadius: 8, objectFit: 'cover', width: "100%", height: "100%",
                    transform: `scale(${scale})`,
                }}
            />
            
            <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-black to-transparent flex items-end justify-center">
                <CameraSelector
                    videoRef={videoRef}
                    streamRef={streamRef}
                    active={active}
                />
            </div>
        </div >
    );
}