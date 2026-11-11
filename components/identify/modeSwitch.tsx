"use client";

import { useRouter } from "next/navigation";
import { CameraSvg, MicSvg } from "@/components/imageSvg";
import { RoundTabs } from "./roundTabs";

// The two ways to identify a bird, as one switch that is the same on both pages: look (photo) or listen (sound).
export default function ModeSwitch({ mode }: { mode: "photo" | "sound" }) {
    const router = useRouter();
    const item = (id: "photo" | "sound", label: string, icon: React.ReactNode, target: string) => ({
        key: id,
        label,
        on: mode === id,
        onPress: () => { if (mode !== id) router.push(target); },
        content: (
            <>
                <span className="h-4 w-4 [&_svg]:!filter-none" aria-hidden>{icon}</span>
                {label}
            </>
        ),
    });
    return <RoundTabs label="Identify by" items={[item("photo", "Photo", CameraSvg, "/identify"), item("sound", "Sound", MicSvg, "/identify-sound")]} />;
}
