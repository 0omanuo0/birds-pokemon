import fs from "node:fs";
import path from "node:path";

// Font bench: lists every font file in public/fonts and renders the same samples in each, so glyph coverage
// (accents, other languages) and crispness at several sizes can be judged before swapping a font in.
export const dynamic = "force-dynamic";

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
const FORMATS: Record<string, string> = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };

const SAMPLES: { lang: string; text: string }[] = [
    { lang: "en", text: "The quick brown fox jumps over the lazy dog 0123456789" },
    { lang: "es", text: "¿Qué pájaro canta? ¡El pingüino! Ñandú, cigüeña, águila, colibrí" },
    { lang: "ca/fr/pt", text: "Çà òl·la, où, être, côté, coração, órgão, ãõ, œuvre" },
    { lang: "de/nl/sv", text: "Schöne Grüße, Straße, Käfer, Ærø, Åland, Øresund, ïj" },
    { lang: "pl/cs/tr", text: "Łąka, żółw, ęć, Šíp, Čáp, Řeka, Ğ ş İ ı, Ő ű" },
    { lang: "symbols", text: "♂ ♀ ★ ♪ ♥ → ← ↑ ↓ … “quotes” ‘single’ — – € % & @ # ·" },
];

const SIZES = [8, 10, 12, 16, 24];

// every accented letter we care about, flagged individually once checked against the font in the browser
const GLYPHS = "áéíóúñüÁÉÍÓÚÑÜ¿¡çàèìòùâêîôûäëïöãõœßłżščřğışåæø";

function fontFamily(file: string) {
    return `bench-${file.replace(/[^a-z0-9]/gi, "_")}`;
}

export default function FontTestPage() {
    const dir = path.join(process.cwd(), "public", "fonts");
    const files = fs.readdirSync(dir).filter(f => FONT_EXT.test(f)).sort();

    const css = files
        .map(f => {
            const ext = f.split(".").pop()!.toLowerCase();
            return `@font-face{font-family:'${fontFamily(f)}';src:url('/fonts/${encodeURIComponent(f)}') format('${FORMATS[ext]}');font-display:block}`;
        })
        .join("\n");

    return (
        <div className="h-dvh overflow-y-auto bg-[#1a1a1a] p-4 text-white">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <script
                dangerouslySetInnerHTML={{
                    // marks glyphs the font lacks: draws each in the bench font and in a bare fallback, and compares widths via canvas
                    __html: `
document.fonts.ready.then(()=>{
  const c=document.createElement('canvas').getContext('2d');
  document.querySelectorAll('[data-glyphs]').forEach(el=>{
    const fam=el.dataset.family;
    el.querySelectorAll('span').forEach(s=>{
      const ch=s.textContent;
      c.font="32px '"+fam+"', monospace"; const a=c.measureText(ch).width;
      c.font="32px 'bench-missing-xyz', monospace"; const b=c.measureText(ch).width;
      // identical width to the monospace fallback usually means the glyph is missing (fallback drawn)
      if(Math.abs(a-b)<0.01) s.style.color='#ff5a5a', s.title='probably missing';
    });
  });
});`,
                }}
            />
            <h1 className="mb-1 text-lg font-bold">Font bench</h1>
            <p className="mb-6 text-sm text-neutral-400">
                {files.length} files in public/fonts. Red glyphs in the coverage row are probably missing (fallback is drawn).
            </p>

            {files.map(f => {
                const fam = fontFamily(f);
                return (
                    <section key={f} className="mb-8 rounded border border-neutral-700 p-3">
                        <h2 className="mb-2 font-mono text-sm text-yellow-400">{f}</h2>

                        <div data-glyphs data-family={fam} style={{ fontFamily: `'${fam}', monospace` }} className="mb-3 text-2xl leading-snug">
                            {GLYPHS.split("").map(ch => (
                                <span key={ch} className="mr-1">{ch}</span>
                            ))}
                        </div>

                        {SAMPLES.map(s => (
                            <div key={s.lang} className="mb-2">
                                <span className="font-mono text-[10px] text-neutral-500">{s.lang}</span>
                                <div style={{ fontFamily: `'${fam}', monospace` }} className="text-base leading-snug">
                                    {s.text}
                                </div>
                            </div>
                        ))}

                        <div className="mt-3 border-t border-neutral-700 pt-2">
                            {SIZES.map(px => (
                                <div key={px} style={{ fontFamily: `'${fam}', monospace`, fontSize: px }} className="leading-snug">
                                    <span className="mr-2 font-mono text-[10px] text-neutral-500">{px}px</span>
                                    Ñandú ¿Qué águila? Pingüino ★ 0123456789
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
