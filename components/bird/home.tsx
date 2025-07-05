"use client";

import LateralLeft from "@/components/nav/lateralLeft";
import PokeballRotation from "@/components/pokeballRotation";
import Noise from "@/components/turbulenceNoise";
import { addSvg, homeSvg, ImageAddSvg, trashSvg } from "@/components/imageSvg";
import type { Bird, Sighting } from "@/lib/types";
import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import HeadCard from "../home/headCard";


async function fetchWikipedia(scientific_name: string): Promise<any[]> {
    const url = `https://es.wikipedia.org/w/rest.php/v1/page/${scientific_name}/html`;

    const response = await fetch(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const sections = Array.from(doc.querySelectorAll('section[data-mw-section-id]'));
    console.log(sections, "sections");
    const result: any[] = [];

    sections.forEach(section => {
        const h2 = section.querySelector("h2[id]");
        if (true) {
            const title = h2?.textContent?.trim() || "Sin título";

            const paragraphs = Array.from(section.querySelectorAll("p"))
                .filter(p => !p.closest("sup") && !p.closest("table"))
                .map(p => {
                    // Clone the <p> to avoid altering the original DOM
                    const clean: any = p.cloneNode(true);
                    // Remove <sup> elements (references)
                    clean.querySelectorAll("sup").forEach((el: any) => el.remove());
                    // Remove <table> elements
                    clean.querySelectorAll("table").forEach((el: any) => el.remove());
                    // Remove all tags except <i> and <b>
                    clean.querySelectorAll("*").forEach((el: any) => {
                        if (el.tagName !== "I" && el.tagName !== "B") {
                            // Replace the element with its text content
                            const textNode = document.createTextNode(el.textContent || "");
                            el.replaceWith(textNode);
                        }
                    });
                    // Print the cleaned HTML as text
                    console.log(clean.innerHTML.trim().replace(/\s+/g, " "), "clean");
                    return clean.innerHTML.trim().replace(/\s+/g, " ");
                })
                .filter(text => text.length > 0);

            if (paragraphs.length > 0) {
                result.push({
                    title,
                    body: paragraphs.join(" ")
                });
            }
        }
    });

    return result;
}


export default function BirdHome({ bird, sightings }: { bird: Bird, sightings: Sighting[] }) {
    const widthImg = 130 - 8 * 2;
    const degrees_per_item = 18; // 360 / 20
    const [selectedImg, setSelectedImg] = useState(0);
    // triplicate the original array
    if (!sightings || sightings.length === 0) {
        return
    }

    const sightingss = sightings;

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.offsetWidth || 0);
        }
        // Escuchar resize del navegador
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth || 0);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const [formattedDate, setFormattedDate] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (sightingss[selectedImg]?.seen_at) {
            const date = new Date(sightingss[selectedImg].seen_at);
            const formatted = date.toLocaleString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }).replace(",", "");
            setFormattedDate(formatted);
        }
    }, [selectedImg, sightingss]);

    const [description, setDescription] = useState<any | undefined>(undefined);

    useEffect(() => {
        // fetch("https://es.wikipedia.org/api/rest_v1/page/summary/" + bird.scientificName.replace(" ", "_"))
        //     .then(response => response.json())
        //     .then(data => {
        //         if (data.extract) {
        //             setDescription(data.extract);
        //         }
        //     })
        //     .catch(error => {
        //         console.error("Error fetching bird description:", error);
        //     });

        fetchWikipedia(bird.scientificName.replace(" ", "_"))
            .then(data => {
                if (data.length > 0) {
                    setDescription(data);
                } else {
                    setDescription("No description available.");
                }
            })
            .catch(error => {
                console.error("Error fetching bird description:", error);
                setDescription("No description available.");
            });
    }, [bird.name]);

    return (
        <main
            className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
        >
            <LateralLeft target='/' setTop="65%">{homeSvg}</LateralLeft>

            <section
                className="relative md:h-[500px] w-full h-fit">
                <div className="h-full w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
                    <Noise />
                    <nav className="flex flex-row justify-between items-center w-full my-2 h-8">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span className="text-neutral-300 text-sm font-medium font-pokemon">Birds Pokedex</span>
                    </nav>
                    <div
                        ref={containerRef}
                        className="w-full h-full bg-neutral-700 pixel-corners-4 relative overflow-hidden noise-effect shining"
                    >
                        <HeadCard selectedBird={{
                            ...bird as any,
                            seen: formattedDate || undefined,
                            location: sightingss[selectedImg].location || undefined
                        }} known_bird={true} />
                        <ul className="flex w-fit select-none items-center h-[150px] mt-4 mb-4"
                            style={{
                                transform: `translateX(${(selectedImg * widthImg - (containerWidth / 2) + (widthImg / 2) + 8) * -1}px)`,
                                transition: "transform 0.3s ease-in-out"
                            }}
                        >
                            {
                                sightingss.map((sighting, index) => (
                                    <li key={index}
                                        style={{
                                            width: `${selectedImg == index ? 150 : 130}px`,
                                            height: `${selectedImg == index ? 150 : 130}px`,
                                            transition: "width 0.3s ease-in-out, height 0.3s ease-in-out",
                                            zIndex: selectedImg == index ? 10 : 1,
                                        }}
                                        className={"flex-shrink-0 -mx-2 overflow-hidden relative " + (selectedImg == index ? "pixel-corners-6-border--wrapper" : "")}>
                                        {selectedImg == index &&
                                            <button className="text-red-700/80 text-xl h-6 w-6 absolute top-2 right-2 z-50 bg-neutral-100 p-1 pixel-corners-4" >
                                                {trashSvg}
                                            </button>
                                        }
                                        <img
                                            src={sighting.photo_url || "/img/bird_placeholder.png"}
                                            alt={"" + sighting.sighting_id || "Unknown Bird"}
                                            className={"aspect-square object-cover shadow-md" + (selectedImg == index ? " pixel-corners-6-border" : "")}
                                            width={200}
                                            height={200}
                                            style={{
                                                filter: selectedImg == index ? "none" : "blur(1px) brightness(0.6) opacity(0.8)",
                                            }}
                                        />
                                    </li>
                                ))
                            }
                        </ul>
                        <div className="h-full w-[calc(100%-16px)] bg-neutral-800 ml-4 relative pt-1"
                            style={{
                                clipPath: "polygon(75% 0, 100% 0, 100% 100%, 0 100%, 0 5%, 70% 5%)",
                                WebkitMaskImage: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                                maskImage: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                            }}
                        >
                            <div className="h-2 w-20 bg-yellow-300 ml-4 absolute top-2 right-2 "
                                style={{
                                    clipPath: "polygon(10% 0%, 100% 0%, 100% 100%, 0% 100%)",
                                }}
                            ></div>
                            <article
                                style={{
                                    backgroundImage: `
                                        linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px),
                                        linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)
                                    `,
                                    backgroundSize: '20px 20px',
                                }}
                                className="bg-white h-[150px] overflow-y-scroll w-[calc(100%-32px)] mx-4 mt-8 pixel-corners-6 px-2 pt-1"
                            >
                                <h2 className="font-pokemon text-black text-2xl">Description:</h2>
                                <div className="text-sm text-neutral-800 p-1 leading-4">
                                    {description && description.map((section: any, index: number) => (
                                        <div key={index} className="mb-2">
                                            { index > 0 && <h3 className="font-bold text-lg">{section.title}</h3> }
                                            <p dangerouslySetInnerHTML={{ __html: section.body }} />
                                        </div>
                                    ))}
                                </div>
                            </article>

                        </div>
                    </div>
                </div>
            </section>
            <PokeballRotation
                startScroll={0}
                endScroll={sightingss.length * degrees_per_item}
                onWheel={(rotation) => {
                    const id = Math.round(rotation / degrees_per_item);
                    if (id < sightingss.length && id >= 0) {
                        setSelectedImg(id);
                    }
                }}
            />

        </main >
    );
}