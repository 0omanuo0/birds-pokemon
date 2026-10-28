import BirdMap from "@/components/bird/birdMap";
import { birdHeatmap, fetchBirdById } from "@/lib/data";
import { ebirdRecentNearby } from "@/lib/ebird";
import { getSessionOrDevBypass } from "@/lib/session";
import { notFound, redirect } from "next/navigation";

// used when this bird has no located sightings of ours yet to center the eBird lookup on instead
const SPAIN_CENTER: [number, number] = [40.2, -3.7];

export default async function BirdMapPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) redirect("/api/auth/signin");

    const { id } = await params;
    const birdId = Number(id);
    if (!Number.isInteger(birdId) || birdId <= 0) notFound();

    const [bird, heatmap] = await Promise.all([fetchBirdById(id), birdHeatmap(birdId)]);
    if (!bird) notFound();

    // eBird's community sightings near where our own users have actually seen this bird, so the extra
    // layer is relevant to them instead of just centered on the whole country
    const [centerLat, centerLng] = heatmap.cells.length > 0
        ? (() => {
            const totalCount = heatmap.cells.reduce((sum, c) => sum + c.count, 0);
            return [
                heatmap.cells.reduce((sum, c) => sum + c.lat * c.count, 0) / totalCount,
                heatmap.cells.reduce((sum, c) => sum + c.lng * c.count, 0) / totalCount,
            ];
        })()
        : SPAIN_CENTER;
    const ebirdSightings = await ebirdRecentNearby(bird.scientificName, centerLat, centerLng, { code: bird.ebirdCode });

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return <BirdMap bird={{ id: bird.id, name: bird.name }} heatmap={heatmap} ebirdSightings={ebirdSightings} />;
}
