import { Capacitor } from "@capacitor/core";

// True inside the Android app's WebView, false in a normal browser or the installed PWA.
// The one place to branch on platform; the offline data layer will hook in here.
export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}
