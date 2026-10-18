"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type PokeballRotationHandle = {
    // Animates the wheel to the given absolute rotation (degrees), e.g. index * degrees_per_item.
    // Imperative on purpose: no prop/effect round trip for the parent to command a position.
    rotateTo: (rotation: number) => void;
};

const PokeballRotation = forwardRef<PokeballRotationHandle, {
    onWheel?: (rotation: number) => void; startScroll: number; endScroll: number; onPress?: () => void; onLongPress?: () => void;
    // degrees per item; when set, the wheel settles onto the nearest item instead of stopping anywhere
    snapStep?: number;
    // when set, a single press waits DOUBLE_TAP_MS to make sure it isn't the first half of a double tap
    onDoubleTap?: () => void;
}>(function PokeballRotation(
    { onWheel, startScroll, endScroll, onPress, onLongPress, snapStep, onDoubleTap }, ref
) {
    const DOUBLE_TAP_MS = 250;
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }, []);
    const [pokRotation, setPokRotation] = useState(startScroll);
    const [isRotating, setIsRotating] = useState(false);
    const [startCords, setStartCoords] = useState({ x: 0, y: 0 });
    // velocity is never read for rendering, only used by the physics loop below,
    // so it belongs in a ref rather than state.
    const velocityRef = useRef(0);
    const MAX_VELOCITY = 20;
    // The Android app (html[data-app]) is touch-only and the list is ~340 birds long: at 1:1 a flick coasted
    // only a few items. In the app a drag turns the wheel APP_GAIN times as far and a flick glides longer.
    // Read when used rather than at render, so server and client render the same.
    const inApp = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-app");
    const APP_GAIN = 2;
    const WEB_FRICTION = 0.95; // per 10ms
    const APP_FRICTION = 0.975;
    // below this speed (degrees per 10ms) the wheel stops coasting and pulls onto the nearest item
    const SNAP_SPEED = 1.5;
    const SNAP_STIFFNESS = 0.08;
    const SNAP_DAMPING = 0.7;
    // Mirrors pokRotation so the physics loop always reads the latest value
    // synchronously (no stale closures), without needing React's functional
    // setState form.
    const pokRotationRef = useRef(startScroll);
    // requestAnimationFrame instead of setInterval: a plain interval can queue
    // up overdue ticks while the main thread is busy (exactly what happens
    // scrolling heavily) and then fire them in a tight back-to-back burst once
    // free, each one doing a cross-component setState — enough of those in one
    // synchronous burst is what was tripping "Maximum update depth exceeded".
    // rAF never backlogs like that: the browser coalesces to at most one call
    // per actual rendered frame.
    const inertiaFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pokeballCenterRef = useRef<HTMLButtonElement>(null);

    // Notifies the parent imperatively, at the moment a new rotation is computed —
    // deliberately NOT via a useEffect watching pokRotation/startScroll/endScroll,
    // which previously round-tripped through the parent's onWheel -> setState ->
    // re-render -> new props -> effect fires again.
    function setRotation(next: number) {
        pokRotationRef.current = next;
        setPokRotation(next);
        const clamped = Math.min(Math.max(next, startScroll), endScroll);
        onWheel?.(clamped);
    }

    const clampedRotation = Math.min(Math.max(pokRotation, startScroll), endScroll);

    useEffect(() => {
        // sync the parent once on mount; subsequent updates go through setRotation above
        onWheel?.(clampedRotation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function stopInertiaLoop() {
        if (inertiaFrameRef.current !== null) {
            cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = null;
        }
    }

    function startRotation(e: any) {
        stopInertiaLoop();

        let centerX = 0;
        let centerY = 0;
        if (pokeballCenterRef.current) {
            const rect = pokeballCenterRef.current.getBoundingClientRect();
            centerX = rect.left + pokeballCenterRef.current.offsetWidth / 2;
            centerY = rect.top + pokeballCenterRef.current.offsetHeight / 2;
        }
        const mouseX = e.clientX || e.touches[0].clientX;
        const mouseY = e.clientY || e.touches[0].clientY;
        const deltaX = mouseX - centerX;
        const deltaY = mouseY - centerY;
        setStartCoords({ x: deltaX, y: deltaY });
        setIsRotating(true);
    }

    function handleRotation(e: any) {
        let centerX = 0;
        let centerY = 0;
        if (pokeballCenterRef.current) {
            const rect = pokeballCenterRef.current.getBoundingClientRect();
            centerX = rect.left + pokeballCenterRef.current.offsetWidth / 2;
            centerY = rect.top + pokeballCenterRef.current.offsetHeight / 2;
        }
        const mouseX = e.clientX || e.touches[0].clientX;
        const mouseY = e.clientY || e.touches[0].clientY;
        const deltaX = mouseX - centerX;
        const deltaY = mouseY - centerY;

        const startAngle = Math.atan2(startCords.y, startCords.x) * (180 / Math.PI);
        const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        const gain = inApp() ? APP_GAIN : 1;
        const angleDifference = (currentAngle - startAngle) * gain;

        if (isRotating) {
            velocityRef.current = Math.max(-MAX_VELOCITY * gain, Math.min(MAX_VELOCITY * gain, angleDifference));
            setRotation(pokRotationRef.current + angleDifference);
            setStartCoords({ x: deltaX, y: deltaY });
        }
    }

    function applyInertia() {
        stopInertiaLoop();
        lastFrameTimeRef.current = performance.now();
        // once the pull toward an item starts it stays on, so the spring's own
        // velocity can't flip the loop back into free coasting mid-settle
        let snapping = false;

        function tick(now: number) {
            // steps: how many "10ms units" elapsed, so the physics feel the same
            // regardless of actual frame rate. Capped so a stalled/backgrounded
            // tab doesn't resume with one giant jump.
            const steps = Math.min((now - lastFrameTimeRef.current) / 10, 5);
            lastFrameTimeRef.current = now;

            const prevVelocity = velocityRef.current;
            const prevRotation = pokRotationRef.current;

            if (snapStep && (snapping || Math.abs(prevVelocity) < SNAP_SPEED)) {
                snapping = true;
                const target = Math.min(Math.max(Math.round(prevRotation / snapStep) * snapStep, startScroll), endScroll);
                const diff = target - prevRotation;
                if (Math.abs(diff) < 0.05 && Math.abs(prevVelocity) < 0.05) {
                    setRotation(target);
                    velocityRef.current = 0;
                    inertiaFrameRef.current = null;
                    return;
                }
                // damped spring: slightly underdamped, so it lands with a small overshoot
                const v = (prevVelocity + diff * SNAP_STIFFNESS * steps) * Math.pow(SNAP_DAMPING, steps);
                velocityRef.current = v;
                setRotation(prevRotation + v * steps);
                inertiaFrameRef.current = requestAnimationFrame(tick);
                return;
            }

            if (Math.abs(prevVelocity) < 0.001) {
                let settled = prevRotation;
                if (prevRotation < 0)
                    settled = Math.min(0, prevRotation + Math.abs(prevRotation) * 0.1); // Spring back to 0
                else if (prevRotation > endScroll)
                    settled = Math.max(endScroll, prevRotation - Math.abs(prevRotation - endScroll) * 0.1); // Spring back to endScroll

                setRotation(settled);
                velocityRef.current = 0;
                inertiaFrameRef.current = null;
                return;
            }

            let newRotation = prevRotation + prevVelocity * steps;
            if (newRotation < 0)
                newRotation = Math.min(0, newRotation + Math.abs(newRotation) * 0.1); // Spring back to 0
            else if (newRotation > endScroll)
                newRotation = Math.max(endScroll, newRotation - Math.abs(newRotation - endScroll) * 0.1); // Spring back to endScroll

            setRotation(newRotation);
            velocityRef.current = prevVelocity * Math.pow(inApp() ? APP_FRICTION : WEB_FRICTION, steps); // Apply friction

            inertiaFrameRef.current = requestAnimationFrame(tick);
        }

        inertiaFrameRef.current = requestAnimationFrame(tick);
    }

    function stopRotation() {
        setIsRotating(false);
        applyInertia();
    }

    // Snaps the wheel to an absolute rotation the parent asks for (e.g. when the
    // underlying list is swapped and we want to land on the same bird's new index).
    // No animation on purpose: the new index can be arbitrarily far from the old
    // one (e.g. jumping to item 340), so easing there would spin the wheel through
    // everything in between, which looks awful — this just shows where it landed.
    function rotateTo(target: number) {
        stopInertiaLoop();
        velocityRef.current = 0;
        const clampedTarget = Math.min(Math.max(target, startScroll), endScroll);
        setRotation(clampedTarget);
    }

    useImperativeHandle(ref, () => ({ rotateTo }));

    // when loads the component make a small animation changing the speed to show that is able to rotate
    useEffect(() => {
        // get the localstorage value for not_new_user
        const notNewUser = localStorage.getItem("not_new_user");
        if (parseInt(notNewUser || "0") > 3) return;

        const t1 = setTimeout(() => {
            velocityRef.current = -1;
            applyInertia();
        }, 1000);

        const t2 = setTimeout(() => {
            velocityRef.current = -0.5;
            applyInertia();
        }, 1500);

        // set the localstorage value for not_new_user to +1
        localStorage.setItem("not_new_user", (parseInt(notNewUser || "0") + 1).toString());

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };

    }, [startScroll]);

    return (
        <div className="absolute bottom-0 w-full z-10 md:w-[400px] md:mx-auto">
            <div
                onTouchStart={startRotation}
                onTouchEnd={stopRotation}
                onMouseDown={startRotation}
                onMouseUp={stopRotation}
                onMouseLeave={stopRotation}
                onWheel={(e) => {
                    e.preventDefault();
                    velocityRef.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocityRef.current + e.deltaY * 0.05));

                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                    }

                    timeoutRef.current = setTimeout(() => {
                        applyInertia();
                    }, 500);
                }}
                onMouseMove={(e) => {
                    e.preventDefault();
                    if (isRotating) {
                        handleRotation(e);
                    }
                }}
                onTouchMove={(e) => {
                    e.preventDefault();
                    if (isRotating) {
                        handleRotation(e);
                    }
                }}
                style={{
                    boxShadow: "0px 0px 30px 0px rgba(0, 0, 0, 0.6)",
                    bottom: "0",
                    left: "50%",
                    transformOrigin: "center",
                    transform: `translateX(-50%) translateY(calc(50% + 3px)) rotate(${clampedRotation.toFixed(2)}deg)`,
                    // One background instead of a clipped red child: two separately
                    // anti-aliased round edges let the grey bleed through as light pixels.
                    // color-mix(srgb, 70%) is exactly the old red-700/70 over neutral-300.
                    backgroundImage: `linear-gradient(to bottom,
                        color-mix(in srgb, var(--color-red-700) 70%, var(--color-neutral-300)) 0 calc(50% - 10px),
                        #2e2728 calc(50% - 10px) 50%,
                        var(--color-neutral-300) 50%)`,
                }}
                className="shadow-lg bg-clip-padding border-[#2e2728] border-8 w-full aspect-square h-auto rounded-full absolute overflow-hidden"
            />
            <button
                onClick={(e) => {
                    e.preventDefault();
                    if (!onDoubleTap) {
                        onPress?.();
                        return;
                    }
                    if (pressTimerRef.current) {
                        // second tap inside the window: it's a double tap, cancel the pending single press
                        clearTimeout(pressTimerRef.current);
                        pressTimerRef.current = null;
                        onDoubleTap();
                        return;
                    }
                    pressTimerRef.current = setTimeout(() => {
                        pressTimerRef.current = null;
                        onPress?.();
                    }, DOUBLE_TAP_MS);
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (onLongPress) {
                        onLongPress();
                    }
                }}
                ref={pokeballCenterRef}
                className="absolute shadow-[0_0_30px_0_rgba(0,0,0,0.6)] left-1/2 transform -translate-x-1/2 -bottom-[43px] rounded-full bg-white bg-clip-padding border-8 border-[#2e2728] w-20 h-20 flex items-center justify-center touch-manipulation hover:cursor-pointer hover:bg-yellow-100 active:bg-yellow-100"
            >
                <div className="bg-[#2e2728] w-10 h-10 rounded-full"></div>
            </button>
        </div>
    );
});

export default PokeballRotation;
