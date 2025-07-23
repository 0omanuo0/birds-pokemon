



export async function GET(req: Request) {
    // fetch https://es.wikipedia.org/w/api.php?action=parse&page=upupa_epops&format=json&prop=sections
    // and then https://es.wikipedia.org/w/api.php?action=parse&page=upupa_epops&section=1&format=json
    // which correspond to Distribución y hábitat, Características, Estado de conservación
    const url = new URL(req.url);
    const bird_name = url.searchParams.get("bird_name");
    if (!bird_name) {
        return new Response(
            JSON.stringify({
                message: 'No bird name provided',
                status: 'error',
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
    const wikiUrl = `https://es.wikipedia.org/w/api.php?action=parse&page=${bird_name}&format=json&prop=sections`;
    const wikiResponse = await fetch(wikiUrl);
    if (!wikiResponse.ok) {
        return new Response(
            JSON.stringify({
                message: 'Failed to fetch bird information from Wikipedia',
                status: 'error',
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
    const wikiData = await wikiResponse.json();
    const sections = wikiData.parse.sections;
    const birdInfo: Record<string, string> = {};

    const desiredSections = [
        'Distribución y hábitat',
        'Características',
        'Estado de conservación'
    ];

    // filter sections to only include those with titles
    const filteredSections = sections.filter((section: { line: string }) =>
        desiredSections.includes(section.line)
    );

    for (const section of filteredSections) {
        const sectionTitle = section.line;
        const sectionId = section.index;
        const sectionUrl = `https://es.wikipedia.org/w/api.php?action=parse&page=${bird_name}&section=${sectionId}&format=json`;
        const sectionResponse = await fetch(sectionUrl);
        if (!sectionResponse.ok) {
            continue; // Skip this section if the fetch fails
        }
        const sectionData = await sectionResponse.json();
        const textContent = sectionData.parse.text['*'];
        birdInfo[sectionTitle] = textContent;
    }

    return new Response(
        JSON.stringify({
            message: 'Bird information fetched successfully',
            status: 'success',
            data: birdInfo,
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}