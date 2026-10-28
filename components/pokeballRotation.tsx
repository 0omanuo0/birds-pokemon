"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useDevice } from "@/components/device/deviceContext";

export type PokeballRotationHandle = {
    // Animates the wheel to the given absolute rotation (degrees), e.g. index * degrees_per_item.
    // Imperative on purpose: no prop/effect round trip for the parent to command a position.
    rotateTo: (rotation: number) => void;
};

const wheelTransform = (rotation: number) => `translateX(-50%) translateY(calc(50% + 3px)) rotate(${rotation.toFixed(2)}deg)`;

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
    // holding the centre this long counts as a long press; a ring fills meanwhile so it reads as "charging"
    const HOLD_MS = 550;
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }, []);
    const device = useDevice();
    const [holding, setHolding] = useState(false);
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    // true once the hold fired, so the click that follows the release isn't also treated as a press
    const holdFiredRef = useRef(false);
    useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }, []);
    // Drag state lives in refs: it changes on every pointer move, and none of it is rendered.
    const isRotatingRef = useRef(false);
    const startCordsRef = useRef({ x: 0, y: 0 });
    // velocity is never read for rendering, only used by the physics loop below,
    // so it belongs in a ref rather than state.
    const velocityRef = useRef(0);
    const MAX_VELOCITY = 20;
    // below this speed (degrees per 10ms) the wheel stops coasting and pulls onto the nearest item
    const SNAP_SPEED = 1.5;
    const SNAP_STIFFNESS = 0.08;
    const SNAP_DAMPING = 0.7;
    // The wheel's rotation. Not state: it changes every pointer move and every inertia frame, and re-rendering the
    // ball (and its parent) that often is what made the controls lag. setRotation writes the transform straight
    // to the element; a re-render for any other reason reads the same value back.
    const pokRotationRef = useRef(startScroll);
    const wheelRef = useRef<HTMLDivElement>(null);
    // the physics loop and the window key listener outlive the render that started them; they read the latest props here
    const propsRef = useRef({ onWheel, startScroll, endScroll, snapStep });
    propsRef.current = { onWheel, startScroll, endScroll, snapStep };
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
        const { onWheel, startScroll, endScroll } = propsRef.current;
        pokRotationRef.current = next;
        const clamped = Math.min(Math.max(next, startScroll), endScroll);
        if (wheelRef.current) wheelRef.current.style.transform = wheelTransform(clamped);
        onWheel?.(clamped);
    }

    const clampedRotation = Math.min(Math.max(pokRotationRef.current, startScroll), endScroll);

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
        startCordsRef.current = { x: deltaX, y: deltaY };
        isRotatingRef.current = true;
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

        const startCords = startCordsRef.current;
        const startAngle = Math.atan2(startCords.y, startCords.x) * (180 / Math.PI);
        const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        let angleDifference = (currentAngle - startAngle);
        // a straight swipe up or down over the middle of the dome counts too (28px per item): thumbs swipe, they don't draw circles
        if (Math.abs(deltaX) < 70) angleDifference += (deltaY - startCords.y) * 18 / 28;

        if (isRotatingRef.current) {
            velocityRef.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, angleDifference));
            setRotation(pokRotationRef.current + angleDifference);
            startCordsRef.current = { x: deltaX, y: deltaY };
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
            const { snapStep, startScroll, endScroll } = propsRef.current;

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
            velocityRef.current = prevVelocity * Math.pow(0.95, steps); // Apply friction

            inertiaFrameRef.current = requestAnimationFrame(tick);
        }

        inertiaFrameRef.current = requestAnimationFrame(tick);
    }

    function stopRotation() {
        isRotatingRef.current = false;
        applyInertia();
    }

    // Snaps the wheel to an absolute rotation the parent asks for (e.g. when the
    // underlying list is swapped and we want to land on the same bird's new index).
    // No animation on purpose: the new index can be arbitrarily far from the old
    // one (e.g. jumping to item 340), so easing there would spin the wheel through
    // everything in between, which looks awful — this just shows where it landed.
    function rotateTo(target: number) {
        const { startScroll, endScroll } = propsRef.current;
        stopInertiaLoop();
        velocityRef.current = 0;
        const clampedTarget = Math.min(Math.max(target, startScroll), endScroll);
        setRotation(clampedTarget);
    }

    useImperativeHandle(ref, () => ({ rotateTo }));

    // ── press / hold, shared by the pointer, the context menu and the keyboard ──
    function cancelHold() {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        setHolding(false);
    }

    function fireHold() {
        holdFiredRef.current = true;
        cancelHold();
        try { navigator.vibrate?.(40); } catch { /* optional */ }
        // a page that sets its own long press keeps it (even an empty one); otherwise holding throws the ball: Catch
        if (onLongPress) onLongPress();
        else device?.holdCatch();
    }

    function startHold() {
        holdFiredRef.current = false;
        cancelHold();
        setHolding(true);
        holdTimerRef.current = setTimeout(fireHold, HOLD_MS);
    }

    function press() {
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
    }

    // one detent in a direction, for the arrow keys: land on the neighbouring item, like a finished spin
    function stepBy(direction: 1 | -1) {
        if (endScroll <= startScroll) return;
        const step = snapStep ?? 18;
        stopInertiaLoop();
        velocityRef.current = 0;
        const base = Math.round(pokRotationRef.current / step) * step;
        setRotation(Math.min(Math.max(base + direction * step, startScroll), endScroll));
    }

    // Keyboard: arrows spin, Enter presses, Space presses (tap) or holds. The handler lives in a ref so the single
    // window listener always sees this render's props and state.
    const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => { });
    keyHandlerRef.current = (e: KeyboardEvent) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        // keys that would activate some other focused control belong to it, not to the ball
        const otherControl = t instanceof HTMLElement && t !== pokeballCenterRef.current && !!t.closest("button, a, [role='button']");

        if (e.type === "keydown") {
            if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); stepBy(1); }
            else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); stepBy(-1); }
            else if (e.key === "Enter" && !otherControl) { e.preventDefault(); if (!e.repeat) press(); }
            else if (e.key === " " && !otherControl) { e.preventDefault(); if (!e.repeat) startHold(); }
        } else if (e.key === " " && !otherControl) {
            e.preventDefault();
            if (holdFiredRef.current) holdFiredRef.current = false;
            else if (holdTimerRef.current) { cancelHold(); press(); }
        }
    };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
        window.addEventListener("keydown", onKey);
        window.addEventListener("keyup", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keyup", onKey);
        };
    }, []);

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
                    if (isRotatingRef.current) {
                        handleRotation(e);
                    }
                }}
                onTouchMove={(e) => {
                    // React's touch listeners are passive, so preventDefault can't stop the page panning: touch-action below does
                    if (isRotatingRef.current) {
                        handleRotation(e);
                    }
                }}
                ref={wheelRef}
                style={{
                    boxShadow: "0px 0px 30px 0px rgba(0, 0, 0, 0.6)",
                    bottom: "0",
                    left: "50%",
                    transformOrigin: "center",
                    transform: wheelTransform(clampedRotation),
                    touchAction: "none",
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
            {/* hold ring: fills while the centre is held, then the long press fires */}
            <svg
                aria-hidden
                viewBox="0 0 104 104"
                className="pointer-events-none absolute left-1/2 -bottom-[55px] z-[1] h-[104px] w-[104px] -translate-x-1/2 -rotate-90"
            >
                <circle
                    cx="52" cy="52" r="48" fill="none" stroke="#facc15" strokeWidth="5"
                    strokeDasharray={301.6} strokeDashoffset={holding ? 0 : 301.6}
                    style={{ opacity: holding ? 1 : 0, transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : "none" }}
                />
            </svg>
            <button
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onClick={(e) => {
                    e.preventDefault();
                    // the click after a long hold is the release of that hold, not a press
                    if (holdFiredRef.current) {
                        holdFiredRef.current = false;
                        return;
                    }
                    press();
                }}
                onContextMenu={(e) => {
                    // touch long-press / right click: same as holding
                    e.preventDefault();
                    if (!holdFiredRef.current) fireHold();
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
