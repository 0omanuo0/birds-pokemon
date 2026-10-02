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
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import { useRouter } from "next/navigation";
import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { loadBirdDescription } from "@/lib/birdDescription";

import { signIn, signOut, useSession } from "next-auth/react";
import { useUser } from "../userContext";

export default function Main({ birds_default, birds_seen}: { birds_default: Bird[], birds_seen: any[]}) {

    const router = useRouter();

    const degrees_per_item = 18; // 360 / 20

    const [selectedBird, setSelectedBird] = useState<Bird>(birds_default[0]);


    const [isFiltered, setIsFiltered] = useState(false);
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

    // Once a bird stays selected for PREFETCH_DELAY_MS, get its page ready before the long-press:
    // the full page data and its Wikipedia description. Only for seen birds, the only ones that can be opened.
    const PREFETCH_DELAY_MS = 700;
    const selectedIndex = selectedBird ? birdsFiltered.findIndex(b => b.id === selectedBird.id) : -1;
    const selectedKnown = selectedIndex >= 0 && !!known_bird[selectedIndex];
    useEffect(() => {
        if (!selectedBird || !selectedKnown) return;
        const timer = setTimeout(() => {
            const birdId = (selectedBird as any).bird_id || selectedBird.id;
            // "full": without it, a dynamic page like /bird/[id] isn't actually prefetched
            router.prefetch(`/bird/${birdId}`, { kind: "full" as PrefetchKind });
            loadBirdDescription(selectedBird.scientificName).catch(() => { });
        }, PREFETCH_DELAY_MS);
        // spinning past a bird cancels its prefetch
        return () => clearTimeout(timer);
    }, [selectedBird, selectedKnown, router]);

    useEffect(() => {
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
    

    // frame, bezel and screen height live in DeviceShell (root layout); this only fills the two cells
    return (
        <>
            <DeviceScreen>
                <Dialog
                    birds_default={birds_default} setBirdsFiltered={setBirdsFiltered}
                    setKnownBird={setKnownBird} birds_seen={birds_seen}
                    showDialogSearch={showDialogSearch} setShowDialogSearch={setShowDialogSearch}
                    onClose={() => setShowDialogSearch(false)}
                />
                <Content
                    birds={birdsFiltered} birdsSeen={birds_seen}
                    setSelectedBird={setSelectedBird} selectedBird={selectedBird}
                    known_bird={known_bird} isFiltered={isFiltered}
                />
            </DeviceScreen>
            <DeviceControls>
            <LateralLeft target='/identify' label="Camera">{CameraSvg}</LateralLeft>
            <LateralRight label="Search" onAction={() => {
                setShowDialogSearch(prev => !prev);
            }}>{searchSvg}</LateralRight>
            <div className="font-pokemon-ns text-lg text-neutral-400 flex gap-6 my-2 shrink-0">
                <span><span>◉</span>Press · <b className="text-amber-400">ALL</b></span>
                <span><span>⊙</span>Hold · <b className="text-amber-400">DEX</b></span>
            </div>
            <PokeballRotation
                ref={pokeballRef}
                snapStep={degrees_per_item}
                onDoubleTap={() => {
                    // runs inside the tap, so the browser allows it; no-op where unsupported (iPhone Safari)
                    if (!document.fullscreenEnabled) return;
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
                    else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => { });
                }}
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
                    if (known_bird[birdsFiltered.findIndex(b => b.id === selectedBird.id)]) {
                        router.push(`/bird/${(selectedBird as any)?.bird_id || selectedBird?.id}`);
                    }
                }}

            />
            </DeviceControls>
        </>
    );
}
