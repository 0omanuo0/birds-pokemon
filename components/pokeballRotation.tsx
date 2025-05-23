import { useEffect, useRef, useState } from "react";

export default function PokeballRotation(
    { onWheel, startScroll, endScroll, onPress, onLongPress }
        : { onWheel: (rotation: number) => void; startScroll: number; endScroll: number; onPress: () => void; onLongPress?: () => void; }
) {
    const [pokRotation, setPokRotation] = useState(startScroll);
    const [isRotating, setIsRotating] = useState(false);
    const [startCords, setStartCoords] = useState({ x: 0, y: 0 });
    const [, setVelocity] = useState(0);
    const inertiaIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);


    useEffect(() => {
        // onwheel
        // console.log("onWheel", pokRotation);
        onWheel(pokRotation);
    }, [pokRotation]);

    function startRotation(e: any) {
        if (inertiaIntervalRef.current) {
            clearInterval(inertiaIntervalRef.current);
            inertiaIntervalRef.current = null;
        }

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const mouseX = e.clientX || e.touches[0].clientX;
        const mouseY = e.clientY || e.touches[0].clientY;
        const deltaX = mouseX - centerX;
        const deltaY = mouseY - centerY;
        setStartCoords({ x: deltaX, y: deltaY });
        setIsRotating(true);
    }

    function handleRotation(e: any) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const mouseX = e.clientX || e.touches[0].clientX;
        const mouseY = e.clientY || e.touches[0].clientY;
        const deltaX = mouseX - centerX;
        const deltaY = mouseY - centerY;

        const startAngle = Math.atan2(startCords.y, startCords.x) * (180 / Math.PI);
        const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        const angleDifference = (currentAngle - startAngle) * -1;
        // console.log(angleDifference);

        if (isRotating) {
            setPokRotation((prevRotation) => {
                setVelocity(angleDifference); // Update velocity
                // console.log(prevRotation, angleDifference);
                return prevRotation + angleDifference;
            });
            setStartCoords({ x: deltaX, y: deltaY });
        }
    }

    function applyInertia() {
        if (inertiaIntervalRef.current) clearInterval(inertiaIntervalRef.current);

        inertiaIntervalRef.current =
            setInterval(() =>
                setVelocity((prevVelocity) => {

                    if (Math.abs(prevVelocity) < 0.001) {
                        if (inertiaIntervalRef.current) clearInterval(inertiaIntervalRef.current);
                        
                        setPokRotation((prevRotation) => {
                            if (prevRotation < 0)
                                return Math.min(0, prevRotation + Math.abs(prevRotation) * 0.1); // Spring back to 0
                            else if (prevRotation > endScroll)
                                return Math.max(endScroll, prevRotation - Math.abs(prevRotation - endScroll) * 0.1); // Spring back to endScroll
                            
                            return prevRotation;
                        });
                        return 0;
                    }
                    
                    setPokRotation((prevRotation) => {
                        const newRotation = prevRotation + prevVelocity;
                        
                        if (newRotation < 0)
                            return Math.min(0, newRotation + Math.abs(newRotation) * 0.1); // Spring back to 0
                        else if (newRotation > endScroll)
                            return Math.max(endScroll, newRotation - Math.abs(newRotation - endScroll) * 0.1); // Spring back to endScroll
                        
                        return newRotation;
                    });

                    return prevVelocity * 0.95; // Apply friction
                })
                , 10) // Roughly 60fps
    }

    function stopRotation() {
        setIsRotating(false);
        applyInertia();
    }

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
                    setVelocity((prevVelocity) => prevVelocity + e.deltaY * 0.05);

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
                    boxShadow: "inset 0px 0px 8px 13px #FFF",
                    bottom: "0",
                    left: "50%",
                    transformOrigin: "center",
                    transform: `translateX(-50%) translateY(50%) rotate(${pokRotation.toFixed(2)}deg)`,
                }}
                className="shadow-lg bg-neutral-300 border-neutral-800 border-8 w-full aspect-square h-auto rounded-full absolute overflow-hidden"
            >
                <div className="bg-red-700/70 w-full h-1/2 border-b-[10px] border-neutral-800"></div>
            </div>
            <button
                onClick={onPress}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (onLongPress) {
                        onLongPress();
                    }
                }}
                className="absolute left-1/2 transform -translate-x-1/2 -bottom-10 rounded-full bg-white border-8 border-neutral-800/95 w-20 h-20 flex items-center justify-center hover:cursor-pointer hover:bg-yellow-100 active:bg-yellow-100 shadow-inset"
            >
                <div className="bg-neutral-800/95 w-10 h-10 rounded-full"></div>
            </button>
        </div>
    );
}