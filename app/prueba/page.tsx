"use client";

import "flatpickr/dist/themes/material_green.css";

import Flatpickr from "react-flatpickr";
import { useEffect, useMemo, useState } from "react";



import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

export default function Home() {

    const date = useMemo(() => new Date(), []);
    const [selectedDate, setSelectedDate] = useState(date);

    useEffect(() => {
        const a = document.querySelector('.flatpickr-input');
        if (a) {
            a.classList.add('w-10', 'bg-red-400', 'h-10', 'rounded-full', 'flex', 'items-center', 'justify-center');
        }
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-black">
            <h1 className="text-2xl font-bold mb-4">Flatpickr Example</h1>
            <div className="">
                <Flatpickr
                    data-enable-time
                    value={selectedDate}
                    onChange={([date]) => {
                        setSelectedDate(date);
                    }}
                />
            </div>

        </div>
    );
}