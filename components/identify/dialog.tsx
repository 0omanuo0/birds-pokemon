"use client";

import { pushBird } from "@/lib/actions";
import { ClockSvg, loaderSvg, PinSvg } from "../imageSvg";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DateTimePicker from "./datetimePicker";
import { useUser } from "../userContext";

const MapWithNoSSR = dynamic(() => import('@/components/identify/map'), {
    ssr: false,
});


export default function Dialog({ showDialog, image, setShowDialog, result }: {
    showDialog: boolean;
    image?: Blob | null;
    setShowDialog: (show: boolean) => void;
    result: any | null;
}) {
    const [saw, setSaw] = useState(false);
    const [loadingMap, setLoadingMap] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [location, setLocation] = useState<[number, number] | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        setSelectedDate(new Date());
    }, [showDialog]);

    const { user } = useUser();


    return (
        <>
            {showMap && (
                <div className="absolute inset-0 w-full h-full z-50">
                    {/* Map container */}
                    <MapWithNoSSR location={location} setLocation={setLocation} />

                    {/* Close button - ensure it renders above everything */}
                    <button
                        className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-md z-[9999] cursor-pointer"
                        onClick={() => setShowMap(false)}
                    >
                        Close Map
                    </button>
                </div>
            )}

            <div className={"absolute top-0 left-0 z-40 w-full h-full flex flex-col items-center justify-center text-black bg-black/40 backdrop-blur-xs noise-effect"
                + (showDialog && result ? "opacity-100" : " opacity-0 pointer-events-none")
            }>

                <div className=" text-white flex flex-col gap-2 items-center justify-center px-1 py-4 absolute left-0 rounded-r-lg border-r-2 border-y-2 border-neutral-800 bg-neutral-500/50 backdrop-blur-sm h-fit">
                    <img src={"icons/pokeball.png"} className="h-[37px] w-10"
                        onClick={() => setSaw(!saw)}
                        style={{
                            filter: saw ? "saturate(100%)" : "saturate(50%)",
                            imageRendering: "pixelated"
                        }} />
                    <span
                        onClick={() => {
                            setLoadingMap(true);
                            navigator.geolocation.getCurrentPosition((position) => {
                                setLocation([position.coords.latitude, position.coords.longitude]);
                                setLoadingMap(false);
                                setShowMap(!showMap);
                            }, (error) => { setLocation(null); setShowMap(true); });
                        }}
                        className="h-10 w-10 flex font-pokemon relative">
                        {PinSvg}
                        {loadingMap ? <span className="text-amber-500 absolute -bottom-0 right-0 text-2xl w-4 h-4 animate-spin">{loaderSvg}</span> :
                            !location ?
                                <span className="text-red-400 absolute -bottom-2 right-0 text-2xl">x</span>
                                : <span className="text-green-400 absolute -bottom-2 right-0 text-base">✓</span>
                        }
                    </span>
                    <span className="h-10 w-10 flex font-pokemon relative">
                        {ClockSvg}
                        <DateTimePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                        <span className="text-green-400 absolute -bottom-2 right-0 text-base">✓</span>
                    </span>
                </div>
                <div
                    style={{
                        backgroundImage: "url('/img/container_info.svg')",
                        backgroundSize: "cover",
                        transition: "height 0.4s cubic-bezier(.4,0,.2,1), opacity 0.4s cubic-bezier(.4,0,.2,1)",
                    }}
                    className={"w-[250px] -mt-10 ml-4 px-3 py-5 transition-all scale-100" + (showDialog ? " h-[200px] opacity-100" : " h-0 opacity-0")}>

                    <div className="bg-main-image px-2 pt-5 pb-2 absolute -bottom-10 -right-4 overflow-visible">
                        <canvas
                            className="w-[120px] h-[100px] aspect-square border border-neutral-500"
                            id="birdCanvas" width={200} height={200}></canvas>

                    </div>

                    <ul className="bg-white h-full rounded-xs w-full mt-[7px] p-1 text-neutral-800 text-base font-pokemon-smaller -space-y-1">
                        {result && (<>
                            <h1 className="text-center text-lg font-bold font-pokemon mb-2 underline tracking-wider">
                                {result.bird.name || "Unknown Bird"}
                            </h1>
                            <li className="">
                                <span className="font-bold">Family:</span> {result.bird.family || "???"}
                            </li>
                            <li className="">
                                <span className="font-bold">Scientific:</span> {result.bird.scientificName || "???"}
                            </li>
                            <li className="">
                                <span className="font-bold">Habitat:</span> {result.bird.habitat || "???"}
                            </li>
                            <li className="">
                                <span className="font-bold">Description:</span> {result.bird.description || "???"}
                            </li>
                        </>)
                        }
                    </ul>
                </div>
                <div className='absolute -top-0 right-0 bg-black'>
                    <button className='text-red-400 text-4xl font-pokemon pl-4 pr-3 pb-1' onClick={() => setShowDialog(false)}>x</button>
                </div>
                <div className="absolute bottom-0 left-0 w-full flex justify-center">
                    <button
                        style={{
                            clipPath: "polygon(15% 0, 85% 0, 100% 70%, 100% 100%, 0 100%, 0 70%)",
                            background: "linear-gradient(130deg, #FCC800 15%,#FFE270 40%, #FCC800 82%)"
                        }}
                        className="bg-yellow-400 text-black text-xl tracking-wider pt-2 font-pokemon px-4 py-1 w-30 shadow-md hover:bg-yellow-500 transition-colors cursor-pointer"
                        onClick={() => {
                            const uuid = crypto.randomUUID();
                            pushBird(user?.user_id, result.bird.id, uuid, location ? `${location[0]},${location[1]}` : undefined, selectedDate.toISOString())
                                .then(async () => {

                                    const formData = new FormData();
                                    formData.append("image", image ? image : new Blob());
                                    formData.append("birdId", result.bird.id.toString());
                                    formData.append("imageId", uuid);
                                    await fetch("/api/saveImage", {
                                        method: "POST",
                                        body: formData
                                    });

                                });
                            alert("Bird added successfully!");
                            setShowDialog(false);

                        }}>
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
                    Add bird!
                </button>
            </div>
        </div >
        </>
    );
}