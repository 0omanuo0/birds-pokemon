



export default function BirdCardScroll(
    { bird, setSelectedBird,  known_bird }
        : { bird: any, setSelectedBird: (bird: any) => void, known_bird: boolean }
) {
    return (
        <li
            id={"bird-item-" + bird.id.toString()}
            className={`space-x-2 px-4 overflow-hidden py-1 bg-neutral-600 rounded-l-sm  h-[32px] select-none`}
            key={bird.id.toString()}
            onClick={() => setSelectedBird(bird)}
        >
            <span
                style={{
                    maxWidth: "70%"
                }}
                className="text-base font-pokemon">{known_bird ? bird.name : "???"}</span>
            <span
                style={{
                    maxWidth: "30%"
                }}
                className="text-xs text-neutral-400 font-pokemon">{bird.scientificName || "???"}</span>
        </li>
    )
}