"use client";
import Flatpickr from "react-flatpickr";
import { useEffect, useMemo, useState } from "react";
import 'leaflet/dist/leaflet.css';

import "flatpickr/dist/themes/material_green.css";



// Invisible flatpickr input laid over whatever it's placed in: tapping that area opens the picker.
// fill: cover the whole positioned parent instead of a 40×40 square.
export default function DateTimePicker({ selectedDate, setSelectedDate, fill = false }: {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    fill?: boolean;
}) {
    useEffect(() => {
        const a = document.querySelector('.flatpickr-input');
        if (a) {
            a.classList.add(...(fill ? ['w-full', 'h-full', 'cursor-pointer'] : ['w-10', 'h-10', 'rounded-full']), 'flex', 'items-center', 'justify-center', "outline-none", "text-transparent", "bg-transparent", "border-0", "selection:text-transparent");
        }
    }, [fill]);

    return (
        <div className={`absolute top-0 left-0 z-50 selection:text-transparent text-transparent ${fill ? "h-full w-full [&>input]:h-full [&>input]:w-full" : ""}`}>
            <Flatpickr
                value={selectedDate}
                data-enable-time
                onChange={([date]) => {
                    setSelectedDate(date);
                }}
            />
        </div>
    );
}