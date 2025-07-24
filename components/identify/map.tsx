import { MapContainer, TileLayer, Marker, Popup, useMapEvent } from 'react-leaflet';
import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon pathing
// Import marker images as URLs
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/img/marker.svg",
    iconSize: [40, 50],
    iconUrl: "/img/marker.svg",
    shadowUrl: "/img/marker-shadow.png",
});

function ContextMenuListener({ onRightClick }: { onRightClick: (latlng: L.LatLng) => void }) {
    useMapEvent('contextmenu', (e) => {
        onRightClick(e.latlng);
    });
    return null;
}

export default function Map({ location, setLocation }: {
    location: [number, number] | null;
    setLocation: (location: [number, number] | null) => void;
}) {
    // Keep initial center only once
    const initialPosition: [number, number] = location || [38.2, -0.75];
    const [position, setPosition] = useState<[number, number]>(initialPosition);
    const markerRef = useRef<L.Marker>(null);

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                const latlng = marker.getLatLng();
                setPosition([latlng.lat, latlng.lng]);
            }
        },
    };

    useEffect(() => {
        setLocation(position);
    }, [position]);

    return (
        <MapContainer
            center={initialPosition}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <ContextMenuListener
                onRightClick={(latlng) => setPosition([latlng.lat, latlng.lng])}
            />

            <Marker
                draggable={true}
                eventHandlers={eventHandlers}
                position={position}
                ref={markerRef}
            >
                <Popup>
                    Marker is at {position[0].toFixed(4)}, {position[1].toFixed(4)}
                </Popup>
            </Marker>
        </MapContainer>
    );
}
