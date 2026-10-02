// Birdwatcher-style groups over the 87 families in the SEO/BirdLife list.
// The data only has families, so this map is the source of truth for "group".
export const BIRD_GROUPS: { name: string; families: string[] }[] = [
    { name: "Waterfowl", families: ["ANATIDAE"] },
    { name: "Gamebirds", families: ["PHASIANIDAE", "TURNICIDAE"] },
    { name: "Grebes & divers", families: ["PODICIPEDIDAE", "GAVIIDAE"] },
    {
        name: "Seabirds", families: [
            "DIOMEDEIDAE", "PROCELLARIIDAE", "HYDROBATIDAE", "OCEANITIDAE", "SULIDAE",
            "PHALACROCORACIDAE", "FREGATIDAE", "PHAETHONTIDAE", "ALCIDAE", "STERCORARIIDAE",
        ]
    },
    { name: "Herons & storks", families: ["ARDEIDAE", "CICONIIDAE", "THRESKIORNITHIDAE", "PHOENICOPTERIDAE", "PELECANIDAE"] },
    { name: "Raptors", families: ["ACCIPITRIDAE", "PANDIONIDAE", "FALCONIDAE"] },
    { name: "Owls", families: ["STRIGIDAE", "TYTONIDAE"] },
    { name: "Cranes & rails", families: ["GRUIDAE", "RALLIDAE", "OTIDIDAE"] },
    {
        name: "Waders", families: [
            "HAEMATOPODIDAE", "RECURVIROSTRIDAE", "BURHINIDAE", "CHARADRIIDAE",
            "SCOLOPACIDAE", "GLAREOLIDAE", "PLUVIANIDAE",
        ]
    },
    { name: "Gulls & terns", families: ["LARIDAE"] },
    { name: "Pigeons & cuckoos", families: ["COLUMBIDAE", "PTEROCLIDAE", "CUCULIDAE", "PSITTACIDAE"] },
    { name: "Swifts & nightjars", families: ["APODIDAE", "CAPRIMULGIDAE"] },
    { name: "Kingfishers & kin", families: ["ALCEDINIDAE", "MEROPIDAE", "CORACIIDAE", "UPUPIDAE", "PICIDAE"] },
    { name: "Larks & swallows", families: ["ALAUDIDAE", "MOTACILLIDAE", "HIRUNDINIDAE"] },
    {
        name: "Thrushes & chats", families: [
            "TURDIDAE", "MUSCICAPIDAE", "CINCLIDAE", "PRUNELLIDAE", "BOMBYCILLIDAE",
            "TROGLODYTIDAE", "MIMIDAE",
        ]
    },
    {
        name: "Warblers", families: [
            "SYLVIIDAE", "ACROCEPHALIDAE", "LOCUSTELLIDAE", "PHYLLOSCOPIDAE", "CISTICOLIDAE",
            "SCOTOCERCIDAE", "REGULIDAE", "PARULIDAE", "VIREONIDAE", "LEIOTHRICHIDAE", "PYCNONOTIDAE",
        ]
    },
    {
        name: "Tits & creepers", families: [
            "PARIDAE", "AEGITHALIDAE", "REMIZIDAE", "PANURIDAE", "SITTIDAE", "TICHODROMIDAE", "CERTHIIDAE",
        ]
    },
    { name: "Shrikes & crows", families: ["LANIIDAE", "MALACONOTIDAE", "CORVIDAE", "ORIOLIDAE", "STURNIDAE"] },
    {
        name: "Sparrows & finches", families: [
            "PASSERIDAE", "PLOCEIDAE", "ESTRILDIDAE", "FRINGILLIDAE", "EMBERIZIDAE", "CALCARIIDAE", "ICTERIDAE",
        ]
    },
];

export const OTHER_GROUP = "Other";

const familyToGroup = new Map<string, string>(
    BIRD_GROUPS.flatMap(g => g.families.map(f => [f, g.name] as [string, string]))
);

export function groupOf(family: string | undefined): string {
    return (family && familyToGroup.get(family.trim().toUpperCase())) || OTHER_GROUP;
}
