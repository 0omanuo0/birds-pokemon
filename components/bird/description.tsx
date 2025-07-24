"use client";

import { useEffect, useState } from "react";




export default function BirdDescription({ description }: { description: any }) {

    const [height, setHeight] = useState(200);

    return (
        <div className={`description-size w-[calc(100%-16px)] px-2 mx-2 pixel-corners-10 absolute overflow-visible -bottom-[28px] left-0 right-0`}
            style={{
                backgroundImage: "linear-gradient(-45deg, #222 30%, #333 60%, #222 70%)",
                transition: "height 0.3s ease-in-out",
                "--desc-height": `${height}px`,
            } as React.CSSProperties}
            onClick={() => {
                setHeight(height === 200 ? 400 : 200);
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setHeight(height === 200 ? 400 : 200);
                }}
                className="absolute -top-2 left-0 right-0 w-full h-8 z-50 bg-transparent ">

            </div>
            <div className="h-[2px] w-[180px] mx-auto bg-neutral-300 my-1"></div>
            <article
                className={`bg-white description-size-article overflow-y-scroll pixel-corners-6 `}
                style={{
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                    transition: "height 0.3s ease-in-out",
                }}
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div className="scrollable-pattern px-2 pt-1 min-h-[var(--desc-height)]">
                    <h2 className="font-pokemon-bw2 text-black"
                        style={{
                            lineHeight: "24px",
                            fontSize: "14px !important"
                        }}
                    >Descripción:</h2>
                    <div className="text-sm text-neutral-800 p-1 leading-4 pb-8">
                        {description && description.map((section: any, index: number) => (
                            <div key={index} className="mb-2">
                                {index > 0 && <h3 className="font-bold text-lg">{section.title}</h3>}
                                <p dangerouslySetInnerHTML={{ __html: section.body }} />
                            </div>
                        ))}
                    </div>
                </div>
            </article>
        </div>
    );
}