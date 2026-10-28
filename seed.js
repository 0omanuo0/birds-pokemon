import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

// node --env-file=.env.local seed.js
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");


const sql = neon(`${DATABASE_URL}`);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// async function run() {
//     //   await client.connect();
//     // Abre el stream de lectura del CSV
//     const csvPath = path.resolve(__dirname, 'LISTA-DE-AVES-SEO-2019.csv');
//     const stream = fs.createReadStream(csvPath).pipe(csv({ separator: ';' }));

//     let family = '';

//     for await (const row of stream) {
//         // Ajusta los nombres de campo al CSV que tengas
//         console.log('row', row);

//         if(row["Species (English)"] === "")
//         {
//             if(row["FAMILIA / Especie (científico)"] === "") continue;
//             console.log('========================family', row["FAMILIA / Especie (científico)"]);
//             family = row["FAMILIA / Especie (científico)"];
//             continue;
//         }

//         const {
//             _ = '',
//             'FAMILIA / Especie (científico)': scientific_name = '',
//             Subespecies: subspecies = '',
//             'Species (English)': name_en = '',
//             'Especie (español)': name_es = '',
//             PB = '',
//             NA = '',
//             CA = '',
//             'Rarezas homologadas por el CR-SEO / Observaciones': seo_notes = ''
//         } = row;


//         await sql`INSERT INTO birds (family, scientific_name, subspecies, name_en, name_es, common_name, PB, NA, CA, seo_notes)
//       VALUES (${family}, ${scientific_name}, ${subspecies}, ${name_en}, ${name_es}, ${name_es}, ${PB !== ''}, ${NA !== ''}, ${CA !== ''}, ${seo_notes})`;
//     }



// }

const birds = [
    "Abubilla común",
    "Agateador europeo",
    "Aguila calzada",
    "Águila pescadora",
    "Águila real",
    "Alcaudón común",
    "Ánade azulón",
    "Ansar común",
    "Avión común",
    "Avión roquero",
    "Buitre leonado",
    "Carbonero común",
    "Carbonero garrapinos",
    "Cernícalo primilla",
    "Cernícalo vulgar",
    "Chochín euroasiático",
    "Chova piquirroja",
    "Cigüeña blanca",
    "Cogujada común",
    "Correlimos tridactilo",
    "Cuervo grande",
    "Escribano triguero",
    "Estornino negro",
    "Flamenco común",
    "Garza real",
    "Gaviota de audouin",
    "Gaviota patiamarilla",
    "Gaviota sombría",
    "Gorrión común",
    "Gorrión molinero",
    "Golondrina común",
    "Golondrina daurica",
    "Grajilla occidental",
    "Herrerillo capuchino",
    "Jilguero europeo",
    "Jilguero lúgano",
    "Lavandera blanca",
    "Lavandera boyera",
    "Mirlo común",
    "Milano real",
    "Milano negro",
    "Morito común",
    "Ostrero",
    "Paloma brávia",
    "Paloma torcaz",
    "Pato cuchara",
    "Pinzón vulgar",
    "Rabilargo ibérico",
    "Reyezuelo listado",
    "Ruiseñor bastardo",
    "Ruiseñor común",
    "Serín verdecillo",
    "Tarabilla europea",
    "Tarro blanco",
    "Tórtola turca",
    "Trepador azul",
    "Urraca común",
    "Vencejo común",
    "Zampullín común"
]

// sighting_idINTEGER
// PRIMARY KEY
// GENERATED ALWAYS AS IDENTITY
// user_idINTEGER
// NOT NULL
// bird_idINTEGER
// NOT NULL
// seen_atTIMESTAMP WITH TIME ZONE
// NOT NULL
// locationVARCHAR(200)
// notesTEXT
// photo_urlTEXT


async function run() {
    // await sql`insert into users (username, email) values ('manu', 'manu365manu@gmail.com')`
    await sql`CREATE EXTENSION IF NOT EXISTS unaccent;`

    for (const bird of birds) {
        // find the bird (or the most similar, contained in the name) in the database
        const pattern = `%${bird}%`;
        const rows = await sql`select * from birds where unaccent(name_es) ilike unaccent(${pattern})`;

        // insert int

        if(!rows) continue;

        if (rows.length > 0) {
            console.log('Found bird:', rows[0].common_name);
            await sql`insert into sightings (user_id, bird_id, seen_at, location, notes, photo_url) values (1, ${rows[0].bird_id}, now(), 'Doñana', ${`Vimos un ${bird}`}, null)`;
        } else {
            // console.log('Bird not found:', bird);
        }
    }

}
run().catch(err => {
    console.error('Error:', err);
});