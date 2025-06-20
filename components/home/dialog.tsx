import { Bird } from "@/lib/types";
import { useState } from "react";
import { searchSvg } from "../imageSvg";



export default function Dialog({
    birds_default, setBirdsFiltered, setKnownBird, birds_seen,
    showDialogSearch, setShowDialogSearch,
    onClose,
}: {
    birds_default: Bird[];
    setBirdsFiltered: (birds: Bird[]) => void;
    setKnownBird: (known: boolean[]) => void;
    showDialogSearch: boolean;
    setShowDialogSearch: (show: boolean) => void;
    birds_seen: any[];
    onClose?: () => void;
}) {
    const [fb, setFB] = useState<Bird[] | null>(null);

    return (
        <div
                style={{
                    transition: "all 0.3s ease-in-out",
                }}
                className={"absolute left-0 w-full p-4 z-50 overflow-hidden pixel-corners-4" + (showDialogSearch ? " top-0 h-full opacity-100 backdrop-blur-xs bg-neutral-800/20 " : "  top-[50%] h-0 opacity-0")}
            >
                <div className="bg-gradient-to-br from-neutral-800 to-neutral-500 h-full w-full p-2 pixel-corners-12 shadow-lg">
                    <div className="flex flex-col bg-gradient-to-bl from-neutral-800 to-neutral-900 pixel-corners-10 w-full h-full overflow-hidden">
                        <div className="bg-white border-b-2 border-neutral-900 after:border-b-1 after:border-neutral-400 after:content-[''] after:block after:w-full">
                            <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                                <h2
                                    style={{
                                        clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                        WebkitMaskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                        maskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                    }}
                                    className={`bg-neutral-700 uppercase font-pokemon relative py-1 px-2 border-b border-yellow-400 shadow-sm`}
                                >
                                    <span style={{ content: "" }} className="bg-yellow-400 w-[2px] h-3 inline-block mx-1"></span>
                                    Filter birds
                                    <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                                </h2>
                            </div>
                            <div className="text-black text-sm -mt-3 text-right uppercase space-x-3 font-pokemon">
                                <span className="mx-2">{fb ? fb?.length : 0} birds</span>
                            </div>
                        </div>
                        <div className="h-full w-full px-2 py-4 relative">
                            <ul className=" flex flex-col gap-2">
                                {
                                    fb ? fb.map((bird, idx) => (
                                        <li key={idx} className="bg-neutral-300 pixel-corners-4 px-3 flex justify-between items-center gap-2 w-full">
                                            <span className="text-black font-pokemon text-ellipsis whitespace-nowrap max-w-[50%]">{bird.scientificName}</span>
                                            <span className="text-neutral-700 text-sm font-pokemon overflow-hidden text-ellipsis whitespace-nowrap max-w-[40%]">{bird.name}</span>
                                        </li>
                                    )) : <div className="text-white font-pokemon w-full h-full text-center">Filter...</div>
                                }
                            </ul>
                            <div className="h-fit w-full px-4 py-4 absolute mx-auto bottom-0 left-0 flex justify-center gap-2 items-center">
                                <div style={{ filter: "drop-shadow(2px 2px 0px #fff4)" }}>
                                    <div className="pixel-corners-6-border--wrapper h-fit w-fit">
                                        <input
                                            id="search-input"
                                            type="text"
                                            placeholder="Search birds..."
                                            onChange={(e) => {
                                                const query = e.target.value.toLowerCase();
                                                if (query.length > 0) {
                                                    const filtered = birds_default.filter(bird =>
                                                        bird.name.toLowerCase().includes(query) ||
                                                        bird.family.toLowerCase().includes(query) ||
                                                        bird.scientificName.toLowerCase().includes(query)
                                                    ).slice(0, 7);
                                                    setFB(filtered);
                                                } else {
                                                    setFB(null);
                                                }
                                            }}
                                            className="pixel-corners-6-border outline-0 text-black bg-neutral-200 focus:bg-neutral-100 text-lg pointer-events-auto h-9 px-4"
                                        />
                                    </div>
                                </div>
                                <div
                                    style={{ filter: "drop-shadow(2px 2px 0px #fff4)" }}>
                                    <button
                                        onClick={() => {
                                            // copy fb to filtered birds and close dialog
                                            const query = (document.querySelector('#search-input') as HTMLInputElement).value.toLowerCase() || '';
                                            const filtered = birds_default.filter(bird =>
                                                bird.name.toLowerCase().includes(query) ||
                                                bird.family.toLowerCase().includes(query) ||
                                                bird.scientificName.toLowerCase().includes(query)
                                            )
                                            setBirdsFiltered(filtered?.map((b, i) => ({ ...b, id: i })) || birds_default);
                                            setKnownBird(filtered ? filtered.map(() => {
                                                return birds_seen.some(bs => bs.bird_id === filtered![0].id);
                                            }) : birds_default.map(() => {
                                                return birds_seen.some(bs => bs.bird_id === bs.id);
                                            }));
                                            setShowDialogSearch(false);
                                        }}
                                        className="h-9 w-9 p-1 bg-neutral-200 hover:bg-neutral-100 cursor-pointer transition-colors duration-300 pixel-corners-6-border text-black"
                                    >
                                        {searchSvg}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
}