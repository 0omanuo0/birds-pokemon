

export interface Bird {
    id: Number;
    name: string;
    scientificName: [string, string];
    family: string;
    seen?: Number;
    location?: string[];
    habitat?: string;
    description?: string;
    image?: string;
    audio?: string;
    size?: string;
    weight?: string;
};