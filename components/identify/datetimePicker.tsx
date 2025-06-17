"use client";
import Flatpickr from "react-flatpickr";
import { useEffect, useMemo, useState } from "react";
import 'leaflet/dist/leaflet.css';

import "flatpickr/dist/themes/material_green.css";



export default function DateTimePicker({ selectedDate, setSelectedDate }: {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
}) {
    useEffect(() => {
        const a = document.querySelector('.flatpickr-input');
        if (a) {
            a.classList.add('w-10','h-10', 'rounded-full', 'flex', 'items-center', 'justify-center', "outline-none", "text-transparent", "bg-transparent", "border-0", "selection:text-transparent");
        }
    }, []);

    return (
        <div className="absolute top-0 left-0 z-50 selection:text-transparent text-transparent">
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