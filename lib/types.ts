

export interface Bird {
    id: number;
    name: string;
    scientificName: [string, string];
    family: string;
    seen?: number;
    location?: string[];
    habitat?: string;
    description?: string;
    image?: string;
    audio?: string;
    size?: string;
    weight?: string;
};