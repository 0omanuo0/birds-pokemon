

async function wiki() {
    const response = await fetch(`https://es.wikipedia.org/w/api.php?action=parse&page=upupa_epops&section=1&format=json`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return response.json();
}

wiki().then(data => {
    const content = data.parse.text['*'];
    console.log(content);
}).catch(error => {
    console.error("Error fetching or parsing data:", error);
});