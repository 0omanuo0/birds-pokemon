"use client";

import Content from "./content";
import PokeballRotation, { PokeballRotationHandle } from "@/components/pokeballRotation";
import { Bird } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import ContextMenu from "../contextMenu";
import LateralLeft from "../nav/lateralLeft";
import LateralRight from "../nav/lateralRight";
import { addSvg, CameraSvg, homeSvg, searchSvg, userSvg } from "../imageSvg";
import Dialog from "./dialog";
import Noise from "@/components/turbulenceNoise";
import { useRouter } from "next/navigation";

import { signIn, signOut, useSession } from "next-auth/react";
import { useUser } from "../userContext";

export default function Main({ birds_default, birds_seen}: { birds_default: Bird[], birds_seen: any[]}) {

    const router = useRouter();

    const degrees_per_item = 18; // 360 / 20

    const [selectedBird, setSelectedBird] = useState<Bird>(birds_default[0]);


    const [_, setIsFiltered] = useState(false);
    const [birdsFiltered, setBirdsFiltered] = useState(birds_default);
    const [known_bird, setKnownBird] = useState<boolean[]>([]);

    const [showDialogSearch, setShowDialogSearch] = useState(false);

    const [isFirstSpin, setIsFirstSpin] = useState(true);

    const user = useUser();

    const pokeballRef = useRef<PokeballRotationHandle | null>(null);
    // Set right before swapping birdsFiltered (e.g. toggling All/Filtered) to the
    // real bird id that was selected, so the effect below can land on that same
    // bird's new index instead of always resetting to the first item.
    const pendingSelectedBirdIdRef = useRef<number | null>(null);

    useEffect(() => {
        let nextIndex = 0;
        if (pendingSelectedBirdIdRef.current !== null) {
            const targetId = pendingSelectedBirdIdRef.current;
            const foundIndex = birdsFiltered.findIndex(b => ((b as any).bird_id ?? b.id) === targetId);
            if (foundIndex !== -1) nextIndex = foundIndex;
            pendingSelectedBirdIdRef.current = null;
        }
        setSelectedBird(birdsFiltered[nextIndex]);
        pokeballRef.current?.rotateTo(nextIndex * degrees_per_item);
        console.log(birdsFiltered, "birdsFiltered", birdsFiltered.length);
    }, [birdsFiltered, known_bird]);



    useEffect(() => {
        if (user === null) {
            router.push("/api/auth/signin");
        }
    }, [user, router]);

    const [loaderTimer, setLoaderTimer] = useState<NodeJS.Timeout | null>(null);
    useEffect(() => {
        // preload /birds/id when the selected bird changes, but wait 1s before doing so
        if (selectedBird) {
            if (loaderTimer) {
                clearTimeout(loaderTimer);
            }
            setLoaderTimer(setTimeout(() => {
                const birdId = (selectedBird as any).bird_id || selectedBird.id;
                console.log("Preloading bird:", birdId);
                router.prefetch(`/bird/${birdId}`);
            }, 1000));

        }

        if( isFirstSpin) {
            setIsFirstSpin(false);
            return;
        }

        // play a sound
            // const audioPath = "/audio/SFX_SLOTS_NEW_SPIN.wav";
            // const audio_ = new Audio(audioPath);
            // audio_.volume = 0.01;
            // audio_.loop = false;
            // audio_.play().catch(err => {
            //     console.error("Error playing sound:", err);
            // });

    }, [selectedBird, router]);
    

    //get buho real in the known birds
    

    return (
        <main
            className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
        >
            <LateralLeft target='/identify' setTop="65%">{CameraSvg}</LateralLeft>
            <LateralRight onAction={() => {
                setShowDialogSearch(prev => !prev);
            }} setTop="65%">{searchSvg}</LateralRight>

            <section
                className="relative md:h-[500px] w-full h-fit">
                <div className="h-full w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
                    <Noise />
                    <nav className="flex flex-row justify-between items-center w-full my-2 h-8">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span className="text-neutral-300 text-sm font-medium font-pokemon">Birds Pokedex</span>
                    </nav>
                    <div
                        className="w-full h-full bg-neutral-700 pixel-corners-4 relative overflow-hidden noise-effect shining"
                    >
                        <Dialog
                            birds_default={birds_default} setBirdsFiltered={setBirdsFiltered}
                            setKnownBird={setKnownBird} birds_seen={birds_seen}
                            showDialogSearch={showDialogSearch} setShowDialogSearch={setShowDialogSearch}
                            onClose={() => setShowDialogSearch(false)}
                        />
                        <Content
                            birds={birdsFiltered} birdsSeen={birds_seen}
                            setSelectedBird={setSelectedBird} selectedBird={selectedBird}
                            known_bird={known_bird}
                        />
                    </div>
                </div>
            </section>
            <PokeballRotation
                ref={pokeballRef}
                onWheel={absoluteRotation => {
                    // console.log(absoluteRotation);
                    // each rotation is 20 items so each item is 18 degrees
                    const id = Math.round(absoluteRotation / degrees_per_item);
                    if (id < birdsFiltered.length && id >= 0) {
                        setSelectedBird(birdsFiltered[id]);
                    }
                }}
                startScroll={0}
                endScroll={(birdsFiltered.length > 0 ? birdsFiltered.length - 1 : 0) * degrees_per_item}
                onPress={() =>
                    setIsFiltered(prev => {
                        pendingSelectedBirdIdRef.current = (selectedBird as any)?.bird_id ?? selectedBird?.id ?? null;

                        if (prev) {
                            // → going _back_ to un-filtered mode
                            setBirdsFiltered(birds_default);
                            // mark each bird “known” if it ever appears in birds_seen
                            setKnownBird(
                                birds_default.map(b =>
                                    birds_seen.some(bs => bs.bird_id === b.id)
                                )
                            );
                        } else {
                            // → going _into_ filtered mode: only show birds you've seen,
                            //    and for each id pick the *last* record from birds_seen
                            const lastSeenById = new Map<number, typeof birds_seen[0]>();
                            birds_seen.forEach(record => {
                                // each successive record with the same bird_id will overwrite,
                                // so at the end Map.get(bird_id) is the last one
                                lastSeenById.set(record.bird_id, record);
                            });

                            const filtered = birds_default
                                .filter(b => lastSeenById.has(b.id))
                                .map((b, idx) => {
                                    const seenRecord = lastSeenById.get(b.id)!;
                                    return {
                                        // keep your default bird fields...
                                        ...b,
                                        // merge in any fields you want from the last-seen record
                                        ...seenRecord,
                                        // re-index for display
                                        id: idx + 1,
                                        bird_id: b.id,
                                    };
                                });

                            console.log("Filtered birds:", filtered);

                            setBirdsFiltered(filtered);
                            // all of the filtered list are “known”
                            setKnownBird(filtered.map(() => true));
                        }

                        return !prev;
                    })
                }
                onLongPress={() => {
                    if (known_bird[selectedBird.id]) {
                        router.push(`/bird/${(selectedBird as any)?.bird_id || selectedBird?.id}`);
                    }
                }}

            />

        </main>
    );
}
