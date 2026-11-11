"use client";

import DexNotice from "@/components/ui/dexNotice";

// "Add a photo" for the identify page. Two ways in, both handled by the phone itself:
//  - Camera app: opens the phone's own camera (all its lenses, zoom and full quality) and returns the picture
//  - Gallery: the file picker, for photos already taken
// Each one is a file input opened from the press that chose it: browsers only allow that inside the tap.
function pick(capture: boolean, onFile: (file: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.setAttribute("capture", "environment");
    input.onchange = () => {
        const file = input.files?.[0];
        if (file) onFile(file);
    };
    input.click();
}

export default function AddPhotoDialog({ open, onClose, onFile }: { open: boolean; onClose: () => void; onFile: (file: File) => void }) {
    return (
        <DexNotice
            open={open}
            title="Add a photo"
            onClose={onClose}
            actions={[
                { label: "Camera", primary: true, onClick: () => { onClose(); pick(true, onFile); } },
                { label: "Gallery", onClick: () => { onClose(); pick(false, onFile); } },
                { label: "Close", onClick: onClose },
            ]}
        >
            Take one with your phone&apos;s own camera app (every lens, full quality), or pick a photo you already have.
        </DexNotice>
    );
}
