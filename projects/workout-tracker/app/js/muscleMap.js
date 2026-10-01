"use strict";

// Authored anatomical body-map (no external assets, fully offline). Draws a
// front- or back-view muscular figure and shades the SPECIFIC head the exercise
// targets in the accent colour, the rest of the musculature in a resting tone.
// Tuned to read like an anatomy chart rather than a flat silhouette.

const ON = "var(--accent)"; // the targeted head
const ON2 = "var(--accent-soft)"; // same muscle, other heads (secondary)
const REST = "#C9B9C4"; // other resting muscle
const LINE = "#9C8896"; // striation / separation lines
const SKIN_F = "#EADFE7"; // body fill (female tone)
const SKIN_M = "#DDE2EC"; // body fill (male tone)

// Real anatomical images (greyscale figure, target muscle in red) from
// Wikimedia Commons — the "Chrizz" muscle set, CC BY-SA. Keyed by the parsed
// muscle id. The service worker runtime-caches them for offline use. Muscles
// with no consistent free image (hamstrings, adductors) fall back to the SVG.
export const MUSCLE_IMG = {
  chest:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Pectoralis_major.png/330px-Pectoralis_major.png",
  delts:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Deltoideus.png/330px-Deltoideus.png",
  biceps:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Biceps_brachii.png/330px-Biceps_brachii.png",
  triceps:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Triceps_brachii.png/330px-Triceps_brachii.png",
  abs: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Rectus_abdominis.png/330px-Rectus_abdominis.png",
  back: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Latissimus_dorsi.png/330px-Latissimus_dorsi.png",
  traps:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Trapezius.png/330px-Trapezius.png",
  glutes:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Gluteus_maximus.png/330px-Gluteus_maximus.png",
  calves:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Gastrocnemius.png/330px-Gastrocnemius.png",
  quads: "https://upload.wikimedia.org/wikipedia/commons/9/99/Quadriceps.png",
};

/* Each muscle is a list of parts; a part carries the head it belongs to so we
   can light just that head. `null` head = lights whenever the muscle is the
   target with no specific head named. viewBox is 0 0 120 232, centred on x=60. */

const FRONT = {
  delts: [
    { head: "anterior", d: "M34 52 Q26 54 25 66 Q33 64 40 60 Z" },
    { head: "anterior", d: "M86 52 Q94 54 95 66 Q87 64 80 60 Z" },
    { head: "lateral", d: "M25 64 Q22 74 28 82 Q34 76 33 66 Z" },
    { head: "lateral", d: "M95 64 Q98 74 92 82 Q86 76 87 66 Z" },
  ],
  chest: [
    { head: "upper", d: "M58 56 Q42 55 35 62 Q46 67 58 65 Z" },
    { head: "upper", d: "M62 56 Q78 55 85 62 Q74 67 62 65 Z" },
    { head: "mid", d: "M58 65 Q44 66 36 73 Q47 79 58 74 Z" },
    { head: "mid", d: "M62 65 Q76 66 84 73 Q73 79 62 74 Z" },
    { head: "lower", d: "M58 74 Q47 78 39 84 Q49 90 58 82 Z" },
    { head: "lower", d: "M62 74 Q73 78 81 84 Q71 90 62 82 Z" },
  ],
  biceps: [
    { head: "long", d: "M24 84 Q20 96 23 108 Q28 100 28 86 Z" },
    { head: "short", d: "M28 86 Q30 98 30 108 Q34 98 32 85 Z" },
    { head: "long", d: "M96 84 Q100 96 97 108 Q92 100 92 86 Z" },
    { head: "short", d: "M92 86 Q90 98 90 108 Q86 98 88 85 Z" },
  ],
  forearms: [
    { head: null, d: "M22 110 Q19 130 24 148 Q30 132 28 112 Z" },
    { head: null, d: "M98 110 Q101 130 96 148 Q90 132 92 112 Z" },
  ],
  abs: [
    { head: null, d: "M53 86 h14 v9 h-14 z" },
    { head: null, d: "M53 97 h14 v9 h-14 z" },
    { head: null, d: "M53 108 h14 v10 h-14 z" },
  ],
  obliques: [
    { head: null, d: "M51 88 Q44 100 48 116 Q52 106 52 92 Z" },
    { head: null, d: "M69 88 Q76 100 72 116 Q68 106 68 92 Z" },
  ],
  quads: [
    { head: null, d: "M40 142 Q35 168 41 196 Q48 192 49 150 Z" },
    { head: null, d: "M50 146 Q49 172 49 196 Q44 196 44 150 Z" },
    { head: null, d: "M80 142 Q85 168 79 196 Q72 192 71 150 Z" },
    { head: null, d: "M70 146 Q71 172 71 196 Q76 196 76 150 Z" },
  ],
  adductors: [
    { head: null, d: "M60 142 Q52 162 58 188 Q60 170 60 150 Z" },
    { head: null, d: "M60 142 Q68 162 62 188 Q60 170 60 150 Z" },
  ],
};

const BACK = {
  traps: [{ head: null, d: "M60 40 Q44 46 40 60 Q52 54 60 48 Q68 54 80 60 Q76 46 60 40 Z" }],
  delts: [
    { head: "posterior", d: "M34 52 Q24 56 26 70 Q34 66 41 60 Z" },
    { head: "posterior", d: "M86 52 Q96 56 94 70 Q86 66 79 60 Z" },
  ],
  back: [
    { head: "lats", d: "M52 66 Q36 78 42 108 Q53 98 54 74 Z" },
    { head: "lats", d: "M68 66 Q84 78 78 108 Q67 98 66 74 Z" },
    { head: "mid", d: "M54 60 Q60 64 66 60 L66 74 Q60 70 54 74 Z" },
  ],
  triceps: [
    { head: "long", d: "M24 84 Q21 98 24 110 Q28 100 28 86 Z" },
    { head: "lateral", d: "M28 86 Q31 100 30 110 Q34 100 32 85 Z" },
    { head: "medial", d: "M26 100 Q27 108 28 112 Q30 108 29 100 Z" },
    { head: "long", d: "M96 84 Q99 98 96 110 Q92 100 92 86 Z" },
    { head: "lateral", d: "M92 86 Q89 100 90 110 Q86 100 88 85 Z" },
    { head: "medial", d: "M94 100 Q93 108 92 112 Q90 108 91 100 Z" },
  ],
  glutes: [
    { head: "max", d: "M59 120 Q42 120 44 142 Q54 148 59 132 Z" },
    { head: "max", d: "M61 120 Q78 120 76 142 Q66 148 61 132 Z" },
    { head: "medius", d: "M44 118 Q38 122 40 132 Q46 128 47 120 Z" },
    { head: "medius", d: "M76 118 Q82 122 80 132 Q74 128 73 120 Z" },
  ],
  hams: [
    { head: null, d: "M42 146 Q37 170 43 196 Q50 190 50 152 Z" },
    { head: null, d: "M78 146 Q83 170 77 196 Q70 190 70 152 Z" },
  ],
  calves: [
    { head: "gastroc", d: "M42 198 Q38 210 44 222 Q50 214 49 200 Z" },
    { head: "gastroc", d: "M78 198 Q82 210 76 222 Q70 214 71 200 Z" },
    { head: "soleus", d: "M44 214 Q43 220 45 224 Q48 220 47 214 Z" },
    { head: "soleus", d: "M76 214 Q77 220 75 224 Q72 220 73 214 Z" },
  ],
};

// front-view body outline
function frontBody(skin) {
  return `
    <circle cx="60" cy="22" r="12"/>
    <path d="M54 31 h12 v9 h-12 z"/>
    <path d="M30 50 Q60 41 90 50 L87 118 Q60 128 33 118 Z"/>
    <path d="M30 50 Q21 54 20 70 L23 112 L33 110 L36 62 Z"/>
    <path d="M90 50 Q99 54 100 70 L97 112 L87 110 L84 62 Z"/>
    <path d="M23 110 L19 150 L29 150 L33 110 Z"/>
    <path d="M97 110 L101 150 L91 150 L87 110 Z"/>
    <path d="M33 116 L87 116 L85 144 L35 144 Z"/>
    <path d="M37 142 L36 198 L52 199 L58 146 Z"/>
    <path d="M83 142 L84 198 L68 199 L62 146 Z"/>
    <path d="M40 197 L43 226 L52 226 L52 197 Z"/>
    <path d="M80 197 L77 226 L68 226 L68 197 Z"/>`.replace(/<(circle|path)/g, `<$1 fill="${skin}"`);
}

// muscle string -> { view, muscle, head, name, heads:[legend] }
function parse(muscle) {
  const m = muscle.toLowerCase();
  const def = (view, mid, head, name, heads) => ({ view, mid, head, name, heads });
  if (m.includes("quad"))
    return def(
      "front",
      "quads",
      m.includes("rectus")
        ? "rectus"
        : m.includes("lateralis")
          ? "lateralis"
          : m.includes("medialis")
            ? "medialis"
            : null,
      "Quadriceps",
      ["Rectus femoris", "Vastus lateralis", "Vastus medialis"],
    );
  if (m.includes("glute"))
    return def(
      "back",
      "glutes",
      m.includes("medius")
        ? "medius"
        : m.includes("minim")
          ? "minimus"
          : m.includes("max")
            ? "max"
            : null,
      "Glutes",
      ["Gluteus maximus", "Gluteus medius", "Gluteus minimus"],
    );
  if (m.includes("hamstring"))
    return def("back", "hams", null, "Hamstrings", [
      "Biceps femoris",
      "Semitendinosus",
      "Semimembranosus",
    ]);
  if (m.includes("calf") || m.includes("calves"))
    return def("back", "calves", m.includes("soleus") ? "soleus" : "gastroc", "Calves", [
      "Gastrocnemius",
      "Soleus",
    ]);
  if (m.includes("inner") || m.includes("adduct"))
    return def("front", "adductors", null, "Adductors", ["Adductor magnus", "Gracilis"]);
  if (m.includes("chest") || m.includes("pec"))
    return def(
      "front",
      "chest",
      m.includes("upper")
        ? "upper"
        : m.includes("lower")
          ? "lower"
          : m.includes("inner")
            ? "inner"
            : null,
      "Chest",
      ["Upper (clavicular)", "Mid (sternal)", "Lower", "Inner (adduction)"],
    );
  if (m.includes("trap"))
    return def(
      "back",
      "traps",
      m.includes("upper")
        ? "upper"
        : m.includes("lower")
          ? "lower"
          : m.includes("mid")
            ? "middle"
            : null,
      "Trapezius",
      ["Upper", "Middle", "Lower"],
    );
  if (m.includes("erector") || m.includes("lower back"))
    return def("back", "back", null, "Lower back", ["Erector spinae"]);
  if (m.includes("back"))
    return def(
      "back",
      "back",
      m.includes("lat") ? "lats" : m.includes("rhomboid") ? "rhomboids" : null,
      "Back",
      ["Latissimus dorsi", "Trapezius", "Rhomboids"],
    );
  if (m.includes("side delt"))
    return def("front", "delts", "lateral", "Side delts", ["Lateral head"]);
  if (m.includes("rear delt") || m.includes("posterior delt"))
    return def("front", "delts", "posterior", "Rear delts", ["Anterior", "Lateral", "Posterior"]);
  if (m.includes("shoulder") || m.includes("delt"))
    return def("front", "delts", null, "Deltoids", ["Anterior", "Lateral", "Posterior"]);
  if (m.includes("tricep"))
    return def(
      "back",
      "triceps",
      m.includes("long")
        ? "long"
        : m.includes("lateral")
          ? "lateral"
          : m.includes("medial")
            ? "medial"
            : null,
      "Triceps",
      ["Long head", "Lateral head", "Medial head"],
    );
  if (m.includes("bicep"))
    return def(
      "front",
      "biceps",
      m.includes("long")
        ? "long"
        : m.includes("short")
          ? "short"
          : m.includes("brachialis")
            ? "brachialis"
            : null,
      "Biceps",
      ["Long head", "Short head", "Brachialis"],
    );
  if (m.includes("obliq"))
    return def("front", "obliques", null, "Obliques", ["External oblique", "Internal oblique"]);
  if (m.includes("serratus"))
    return def("front", null, null, "Serratus anterior", ["Serratus anterior"]);
  if (m.includes("forearm"))
    return def(
      "front",
      "forearms",
      m.includes("flexor")
        ? "flexors"
        : m.includes("extensor")
          ? "extensors"
          : m.includes("brachi")
            ? "brachioradialis"
            : null,
      "Forearms",
      ["Wrist flexors", "Wrist extensors", "Brachioradialis"],
    );
  if (m.includes("ab")) return def("front", "abs", null, "Core", ["Rectus abdominis", "Obliques"]);
  return def("front", null, null, muscle, []);
}

// SVG fallback visual (used only for muscles without a real image)
function svgVisual(info, gender) {
  const skin = gender === "male" ? SKIN_M : SKIN_F;
  const set = info.view === "back" ? BACK : FRONT;
  const body = frontBody(skin);
  let svg = "";
  for (const mid in set) {
    const isTarget = mid === info.mid;
    for (const part of set[mid]) {
      let fill = REST;
      if (isTarget) {
        // no specific head -> light the whole muscle; otherwise just that head
        fill = !info.head ? ON : part.head === info.head ? ON : ON2;
      }
      svg += `<path d="${part.d}" fill="${fill}" stroke="${LINE}" stroke-width="0.4"/>`;
    }
  }
  return `
    <svg class="anat-svg" viewBox="0 0 120 232" aria-hidden="true">
      <g class="anat-body">${body}</g>
      ${svg}
    </svg>`;
}

export function muscleDiagram(muscle, gender) {
  const info = parse(muscle);
  const img = MUSCLE_IMG[info.mid];

  // legend: name the heads; mark the targeted one
  const legend = info.heads
    .map((h) => {
      const on = info.head && h.toLowerCase().includes(info.head);
      return `<li class="${on ? "on" : ""}">${h}</li>`;
    })
    .join("");
  const headLabel = info.head ? " · " + info.head[0].toUpperCase() + info.head.slice(1) : "";

  const visual = img
    ? `<img class="anat-img" src="${img}" referrerpolicy="no-referrer" loading="lazy" alt="${info.name} highlighted">`
    : svgVisual(info, gender);
  const credit = img
    ? '<a class="anat-credit" href="https://commons.wikimedia.org/wiki/Category:Muscles_of_the_human_body" target="_blank" rel="noopener">illustration: Wikimedia · CC BY-SA</a>'
    : "";

  return `
    <div class="muscle-map">
      ${visual}
      <div class="muscle-info">
        <div class="muscle-region">${info.name}${headLabel}</div>
        <ul class="muscle-legend">${legend}</ul>
        ${credit}
      </div>
    </div>`;
}
