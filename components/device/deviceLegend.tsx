"use client";

import { useDevice } from "./deviceContext";

// The simple legend above the ball ("◉ Press · ALL   ⊙ Hold · DEX"): what the ball does on this page.
// Pages set it with <DeviceHintsSetter/> (or the cursor does it for its stops); null hides press / hold,
// and `more` adds further entries.
export default function DeviceLegend() {
    const device = useDevice();
    if (!device) return null;
    const { press, hold, more } = device.hints;

    const entry = (symbol: string, verb: string, label: string) => (
        <span key={verb}><span>{symbol}</span>{verb} · <b className="uppercase text-amber-400">{label}</b></span>
    );

    return (
        <div className="font-pokemon-ns text-lg text-neutral-400 flex flex-wrap justify-center gap-x-5 gap-y-0 my-2 shrink-0">
            {press != null && entry("◉", "Press", press)}
            {hold != null && entry("⊙", "Hold", hold)}
            {more?.map(m => entry(m.symbol, m.verb, m.label))}
        </div>
    );
}
