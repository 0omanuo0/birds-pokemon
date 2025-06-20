



export default function BirdCardScroll(
    { bird, setSelectedBird, known_bird }
        : { bird: any, setSelectedBird: (bird: any) => void, known_bird: boolean }
) {
    return (
        <li
            id={"bird-item-" + bird.id.toString()}
            className={`flex items-center px-4 py-1 -mr-2 bg-neutral-600 pixel-corners-4 h-[32px] select-none`}
            key={bird.id.toString()}
            onClick={() => setSelectedBird(bird)}
        >
            <>
                {
                    known_bird ?
                        <span
                            className="text-base font-pokemon whitespace-nowrap overflow-ellipsis pr-2"
                        >
                            {bird.name}
                        </span>
                        : <span
                            className="text-base font-pokemon whitespace-nowrap  min-w-0 pr-2 mr-2"
                        >{"???"}</span>
                }
                <span
                    className={"text-xs text-neutral-400 font-pokemon whitespace-nowrap overflow-hidden text-ellipsis flex-shrink mt-[2px] pr-2" }
                >
                    {bird.scientificName || "???"}
                </span>
            </>
        </li >
    )
}