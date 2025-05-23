


export default function HeadCard(
    { selectedBird, known_bird }: { selectedBird: any, known_bird: any }
) {
    console.log("selectedBird", selectedBird);
    return (
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
                    {selectedBird.name}(id: {selectedBird.id.toString()})
                    <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                </h2>
            </div>
            <div className="text-black text-sm py-1 text-right uppercase space-x-3 font-pokemon">
                <span>Seen  {(known_bird ? selectedBird?.seen?.toString() : "???") || "???"}</span>
                <span className="mx-2">Location  {(known_bird ? selectedBird?.location : "???") || "???"}</span>
            </div>
        </div>
    )
}