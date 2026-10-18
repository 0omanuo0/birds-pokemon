import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";

// Shown at once while a device page's server data loads. Without a loading boundary Next can't
// prefetch these dynamic pages, so every tab drag waited for the server (Vercel + Neon) before
// anything moved, which feels like lag in the Android app. The shell and bezel stay; only the
// screen is empty for a moment.
export default function Loading() {
    return (
        <>
            <DeviceScreen animate={false}>
                <div className="flex-1" />
            </DeviceScreen>
            <DeviceControls>
                <div />
            </DeviceControls>
        </>
    );
}
