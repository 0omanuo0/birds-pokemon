


export default function Noise() {
    return (
        <svg width="0" height="0" id="noise">
            <defs>
                <filter id="noiseFilter">
                    <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" />
                    <feBlend mode="soft-light" in="SourceGraphic" />
                </filter>
            </defs>
        </svg>
    )
}