

export interface Bird {
    id: number;
    name: string;
    scientificName: string;
    family: string;
    habitat?: string;
    description?: string;
    audio?: string;
    size?: string;
    weight?: string;
    na : boolean;
    ca : boolean;
    pb : boolean;
    nameEn?: string;
    // SEO rarity code R1/R2 present in seo_notes
    rare?: boolean;
};

export interface Sighting{
    sighting_id: number;
    user_id: number;
    bird_id: number;
    seen_at: string;
    location: string;
    notes: string | null;
    photo_url: string;

}