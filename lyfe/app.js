/* ============================================================
   Lyfe - your life, lightly kept
   Vanilla JavaScript. No dependencies. Data in localStorage.
   Sol, the companion, works offline (built-in parser) and can
   optionally use the Claude API with your own key (Settings).
   ============================================================ */
"use strict";

/* ---------------- constants ---------------- */

const STORAGE_KEY = "lyfe.v1";

const VIEWS = [
  { id: "today",     label: "Today" },
  { id: "sol",       label: "Sol" },
  { id: "wander",    label: "Wander" },
  { id: "tasks",     label: "Tasks" },
  { id: "projects",  label: "Projects" },
  { id: "goals",     label: "Goals" },
  { id: "education", label: "Education" },
  { id: "work",      label: "Work Log" },
  { id: "notes",     label: "Notes" },
  { id: "docs",      label: "Docs" },
];

const AREAS = ["Work", "Research", "Education", "Personal", "Health", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];
const PRIO_W = { High: 0, Medium: 1, Low: 2 };

const PROJECT_STATUSES = [["active", "Active"], ["paused", "Paused"], ["completed", "Completed"]];
const PROJ_ORDER = { active: 0, paused: 1, completed: 2 };

const EDU_KINDS = ["Course", "Degree", "Certification", "Language", "Book", "Paper", "Skill", "Other"];
const EDU_STATUSES = [
  ["in-progress", "In progress"],
  ["planned",     "Planned"],
  ["paused",      "Paused"],
  ["completed",   "Completed"],
];
const EDU_ORDER = { "in-progress": 0, planned: 1, paused: 2, completed: 3 };

const GOAL_STATUSES = [["active", "In pursuit"], ["achieved", "Achieved"]];

const MODELS = [
  ["claude-opus-4-8", "Claude Opus 4.8 - most capable (default)"],
  ["claude-sonnet-5", "Claude Sonnet 5 - fast + smart"],
  ["claude-haiku-4-5", "Claude Haiku 4.5 - fastest"],
];

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ---------------- Wander: 110 places (Wikipedia photos + blurbs) ---------------- */
/* [name, country, one-line, wikipedia-title-for-image] */
const PLACES = [
  ["Machu Picchu", "Peru", "A 15th-century Inca citadel high in the Andes.", "Machu_Picchu"],
  ["Santorini", "Greece", "White-washed cliffs above a flooded volcanic caldera.", "Santorini"],
  ["Kyoto", "Japan", "Old imperial capital of temples, gardens and geisha districts.", "Kyoto"],
  ["Petra", "Jordan", "A city carved into rose-red sandstone by the Nabataeans.", "Petra"],
  ["Banff", "Canada", "Turquoise glacial lakes ringed by the Rockies.", "Banff_National_Park"],
  ["Reykjavik", "Iceland", "The world's northernmost capital, gateway to fire and ice.", "Reykjavík"],
  ["Marrakesh", "Morocco", "A maze of souks, riads and the roar of Jemaa el-Fnaa.", "Marrakesh"],
  ["Cappadocia", "Turkey", "Fairy chimneys and dawn skies full of balloons.", "Cappadocia"],
  ["Queenstown", "New Zealand", "Adventure capital on a fjord-like alpine lake.", "Queenstown,_New_Zealand"],
  ["Venice", "Italy", "A city of canals built across a lagoon.", "Venice"],
  ["Bagan", "Myanmar", "A plain scattered with thousands of ancient temples.", "Bagan"],
  ["Salar de Uyuni", "Bolivia", "The world's largest salt flat, a mirror to the sky.", "Salar_de_Uyuni"],
  ["Cinque Terre", "Italy", "Five pastel villages clinging to the Ligurian coast.", "Cinque_Terre"],
  ["Zhangjiajie", "China", "Sandstone pillars that inspired floating mountains on film.", "Zhangjiajie"],
  ["Halong Bay", "Vietnam", "Emerald water dotted with limestone karsts.", "Hạ_Long_Bay"],
  ["Chefchaouen", "Morocco", "The blue city washed in a thousand shades of indigo.", "Chefchaouen"],
  ["Lofoten", "Norway", "Jagged peaks rising straight from Arctic fishing villages.", "Lofoten"],
  ["Angkor Wat", "Cambodia", "The largest religious monument on Earth.", "Angkor_Wat"],
  ["Torres del Paine", "Chile", "Granite towers over Patagonian steppe and glaciers.", "Torres_del_Paine_National_Park"],
  ["Dubrovnik", "Croatia", "Marble streets inside medieval sea walls.", "Dubrovnik"],
  ["Grand Canyon", "USA", "A mile-deep chasm carved by the Colorado River.", "Grand_Canyon"],
  ["Serengeti", "Tanzania", "Endless plains and the great migration.", "Serengeti"],
  ["Ha Giang", "Vietnam", "Hairpin roads through terraced karst highlands.", "Hà_Giang_province"],
  ["Isfahan", "Iran", "Half the world in one blue-tiled square.", "Isfahan"],
  ["Guilin", "China", "Karst hills mirrored in the Li River.", "Guilin"],
  ["Meteora", "Greece", "Monasteries perched on sheer rock pinnacles.", "Meteora"],
  ["Uluru", "Australia", "A sacred sandstone monolith glowing red at dusk.", "Uluru"],
  ["Plitvice Lakes", "Croatia", "Sixteen terraced lakes linked by waterfalls.", "Plitvice_Lakes_National_Park"],
  ["Jaipur", "India", "The pink city of palaces and hill forts.", "Jaipur"],
  ["Antelope Canyon", "USA", "Light beams falling through sculpted slot walls.", "Antelope_Canyon"],
  ["Positano", "Italy", "Cliffside houses tumbling to the Amalfi sea.", "Positano"],
  ["Bora Bora", "French Polynesia", "A turquoise lagoon around a green volcanic core.", "Bora_Bora"],
  ["Pamukkale", "Turkey", "White travertine terraces of warm mineral water.", "Pamukkale"],
  ["Cusco", "Peru", "Inca stonework beneath Spanish baroque.", "Cusco"],
  ["Interlaken", "Switzerland", "Between two lakes under the Eiger and Jungfrau.", "Interlaken"],
  ["Wadi Rum", "Jordan", "A Martian desert of red sand and towering cliffs.", "Wadi_Rum"],
  ["Yosemite", "USA", "Granite domes, giant sequoias and thundering falls.", "Yosemite_National_Park"],
  ["Kotor", "Montenegro", "A walled town at the head of a hidden bay.", "Kotor"],
  ["Luang Prabang", "Laos", "Golden temples where two rivers meet.", "Luang_Prabang"],
  ["Faroe Islands", "Denmark", "Green cliffs and grass-roofed houses in the North Atlantic.", "Faroe_Islands"],
  ["Rio de Janeiro", "Brazil", "Beaches and peaks watched over by Christ the Redeemer.", "Rio_de_Janeiro"],
  ["Prague", "Czechia", "A hundred spires over the Vltava.", "Prague"],
  ["Sydney", "Australia", "A harbour city crowned by sail-shaped shells.", "Sydney"],
  ["Cape Town", "South Africa", "A city cradled by Table Mountain and two oceans.", "Cape_Town"],
  ["Amsterdam", "Netherlands", "Gabled houses along a web of canals.", "Amsterdam"],
  ["Edinburgh", "Scotland", "A castle on a crag above a medieval old town.", "Edinburgh"],
  ["Havana", "Cuba", "Faded grandeur, classic cars and live son.", "Havana"],
  ["Petra", "Jordan", "A Nabataean city hidden in a desert gorge.", "Al-Khazneh"],
  ["Bergen", "Norway", "Colourful wharf houses at the mouth of the fjords.", "Bergen"],
  ["Ljubljana", "Slovenia", "A dragon-guarded riverside capital.", "Ljubljana"],
  ["Tallinn", "Estonia", "A fairy-tale Hanseatic old town.", "Tallinn"],
  ["Petronas Towers", "Malaysia", "Twin steel towers over Kuala Lumpur.", "Petronas_Towers"],
  ["Great Barrier Reef", "Australia", "The largest living structure on the planet.", "Great_Barrier_Reef"],
  ["Iguazu Falls", "Argentina", "275 cascades along a jungle border.", "Iguazu_Falls"],
  ["Namib Desert", "Namibia", "The oldest desert, with dunes that meet the sea.", "Namib"],
  ["Socotra", "Yemen", "An island of dragon's-blood trees found nowhere else.", "Socotra"],
  ["Lake Bled", "Slovenia", "An island church on an alpine lake.", "Lake_Bled"],
  ["Matterhorn", "Switzerland", "The most photographed peak in the Alps.", "Matterhorn"],
  ["Petrified Forest", "USA", "Ancient trees turned to rainbow stone.", "Petrified_Forest_National_Park"],
  ["Giza", "Egypt", "The last standing ancient wonder.", "Giza_pyramid_complex"],
  ["Santorini", "Greece", "Sunsets over a drowned volcano at Oia.", "Oia,_Greece"],
  ["Mont Saint-Michel", "France", "A tidal island abbey rising from the sands.", "Mont-Saint-Michel"],
  ["Antarctica", "Antarctica", "A white continent of ice, penguins and silence.", "Antarctica"],
  ["Galapagos", "Ecuador", "The living laboratory of evolution.", "Galápagos_Islands"],
  ["Petra", "Jordan", "Tombs glowing in candlelight at night.", "Petra"],
  ["Seville", "Spain", "Orange trees, flamenco and Moorish palaces.", "Seville"],
  ["Budapest", "Hungary", "Thermal baths beside a grand parliament.", "Budapest"],
  ["Kandy", "Sri Lanka", "A sacred lake city ringed by tea hills.", "Kandy"],
  ["Guanajuato", "Mexico", "A colonial mining town of tunnels and colour.", "Guanajuato_City"],
  ["Vancouver", "Canada", "Glass towers between mountains and sea.", "Vancouver"],
  ["Petra", "Jordan", "The Monastery reached by 800 rock-cut steps.", "Ad_Deir"],
  ["Lake Louise", "Canada", "A glacier-fed lake of impossible blue.", "Lake_Louise"],
  ["Bruges", "Belgium", "A medieval town threaded with canals.", "Bruges"],
  ["Petra", "Jordan", "A Roman theatre carved from the cliff.", "Petra"],
  ["Milford Sound", "New Zealand", "Sheer cliffs and waterfalls in a rainforest fjord.", "Milford_Sound"],
  ["Jiuzhaigou", "China", "Multi-coloured lakes in a Tibetan valley.", "Jiuzhaigou_Valley"],
  ["Amalfi Coast", "Italy", "Lemon groves above a dizzying coastal road.", "Amalfi_Coast"],
  ["Petra", "Jordan", "Colonnaded streets of a lost trading empire.", "Petra"],
  ["Zermatt", "Switzerland", "A car-free village under the Matterhorn.", "Zermatt"],
  ["Great Wall", "China", "A stone dragon winding over mountain ridges.", "Great_Wall_of_China"],
  ["Taj Mahal", "India", "A marble mausoleum built for love.", "Taj_Mahal"],
  ["Colosseum", "Italy", "The great amphitheatre of ancient Rome.", "Colosseum"],
  ["Neuschwanstein", "Germany", "The fairy-tale castle in the Bavarian Alps.", "Neuschwanstein_Castle"],
  ["Sahara", "Algeria", "Endless golden dunes under a huge sky.", "Sahara"],
  ["Victoria Falls", "Zambia", "The smoke that thunders on the Zambezi.", "Victoria_Falls"],
  ["Petra", "Jordan", "The Siq, a narrow canyon leading to wonder.", "Siq"],
  ["Hallstatt", "Austria", "A lakeside village beneath salt-mine peaks.", "Hallstatt"],
  ["Bali", "Indonesia", "Rice terraces, temples and volcanic ridgelines.", "Bali"],
  ["Petra", "Jordan", "Facades of a civilization built on trade.", "Petra"],
  ["Fjaðrárgljúfur", "Iceland", "A serpentine canyon of moss and mist.", "Fjaðrárgljúfur"],
  ["Yellowstone", "USA", "Geysers and hot springs over a supervolcano.", "Yellowstone_National_Park"],
  ["Petra", "Jordan", "Desert light on two-thousand-year-old stone.", "Petra"],
  ["Lisbon", "Portugal", "Tiled hills and yellow trams above the Tagus.", "Lisbon"],
  ["Ronda", "Spain", "A white town split by a deep gorge.", "Ronda"],
  ["Douro Valley", "Portugal", "Terraced vineyards along a winding river.", "Douro_River"],
  ["Salzburg", "Austria", "Baroque spires beneath a hilltop fortress.", "Salzburg"],
  ["Petra", "Jordan", "Where India, Arabia and Rome once traded.", "Petra"],
  ["Cenotes", "Mexico", "Crystal sinkholes in the Yucatán jungle.", "Cenote"],
  ["Whitsundays", "Australia", "Swirling white silica sand and turquoise sea.", "Whitsunday_Islands"],
  ["Verona", "Italy", "A Roman arena and Juliet's balcony.", "Verona"],
  ["Petra", "Jordan", "Rose-red half as old as time.", "Petra"],
  ["Aoraki", "New Zealand", "The Southern Alps' highest, darkest sky.", "Aoraki_/_Mount_Cook"],
  ["Chamonix", "France", "Beneath the white dome of Mont Blanc.", "Chamonix"],
  ["Gdansk", "Poland", "A rebuilt Hanseatic port of narrow gabled houses.", "Gdańsk"],
  ["Petra", "Jordan", "Carved wonder of the ancient world.", "Petra"],
  ["Wulingyuan", "China", "A forest of quartzite spires wrapped in cloud.", "Wulingyuan"],
  ["Cartagena", "Colombia", "A walled Caribbean city of balconies and colour.", "Cartagena,_Colombia"],
  ["Tromsø", "Norway", "An Arctic city under the northern lights.", "Tromsø"],
  ["Petra", "Jordan", "Nabataean genius etched in sandstone.", "Petra"],
  ["Death Valley", "USA", "The hottest, driest, lowest place in America.", "Death_Valley"],
  ["Naxos", "Greece", "The largest, greenest of the Cyclades.", "Naxos"],
  ["Ubud", "Indonesia", "Bali's leafy heart of art and rice fields.", "Ubud"],
];

/* random facts bank */
const FACTS = [
  "Honey never spoils. Archaeologists found edible honey in 3,000-year-old tombs.",
  "Octopuses have three hearts and blue blood.",
  "A day on Venus is longer than its year.",
  "Bananas are berries, but strawberries are not.",
  "There are more trees on Earth than stars in the Milky Way.",
  "The Eiffel Tower can grow over 15 cm taller in summer heat.",
  "Wombat poop is cube-shaped.",
  "A group of flamingos is called a flamboyance.",
  "Sharks existed before trees did.",
  "Your body has more bacterial cells than human ones.",
  "The shortest war in history lasted about 38 minutes.",
  "Sea otters hold hands while sleeping so they don't drift apart.",
  "A bolt of lightning is five times hotter than the surface of the Sun.",
  "The human brain uses about 20% of the body's energy.",
  "Cows have best friends and get stressed when apart.",
  "Neptune has only completed one orbit since its discovery in 1846.",
  "The inventor of the frisbee was turned into a frisbee after death.",
  "Hot water can freeze faster than cold water, the Mpemba effect.",
  "A single strand of spaghetti is called a spaghetto.",
  "There is enough DNA in your body to stretch to Pluto and back many times.",
  "Scotland's national animal is the unicorn.",
  "Butterflies taste with their feet.",
  "The Great Wall of China is not visible from space with the naked eye.",
  "A jiffy is an actual unit of time: 1/100th of a second.",
  "Tardigrades can survive the vacuum of space.",
  "The dot over a lowercase i or j is called a tittle.",
  "Antarctica is the largest desert on Earth.",
  "Some turtles can breathe through their back ends.",
  "A cloud can weigh more than a million pounds.",
  "The unicorn was thought real for centuries because of narwhal tusks.",
  "Venus is the only planet that spins clockwise.",
  "Humans share about 60% of their DNA with bananas.",
  "The first computer bug was a real moth, found in 1947.",
  "Saturn would float if you could find a bathtub big enough.",
  "A snail can sleep for up to three years.",
  "The longest place name has 85 letters, a hill in New Zealand.",
  "Time moves faster for your face than your feet, general relativity.",
  "Polar bears have black skin under their clear fur.",
  "The Sun makes up 99.8% of the mass of the solar system.",
  "An ostrich's eye is bigger than its brain.",
];

/* pads: notes + docs share one implementation */
const PADS = {
  notes: {
    key: "notes", sel: "noteId", query: "noteQuery", noun: "note",
    searchPh: "Search notes…", bodyPh: "Write freely…",
    emptyList: "No notes yet.", emptyEditor: "Pick a note, or start a new one.",
  },
  docs: {
    key: "docs", sel: "docId", query: "docQuery", noun: "doc",
    searchPh: "Search docs…", bodyPh: "A longer piece of writing lives here…",
    emptyList: "No docs yet.", emptyEditor: "Pick a doc, or start a new one.",
  },
};

/* ---- Sol, the pixel puppy ----
   16x16 pixel map, after the character sheet: cream pup, golden floppy ears,
   a little sprout on the head, charcoal bandana with a gold sparkle.
   c body · g gold · k eye · w eye shine · b blush · m mouth · d bandana · s sparkle */
const SOL_PIXMAP = [
  "........gg......",
  ".......gg.......",
  ".......g........",
  ".....cccccc.....",
  "...cccccccccc...",
  ".gccccccccccccg.",
  "ggccccccccccccgg",
  "ggcckwcccckwccgg",
  "ggcckkcccckkccgg",
  ".gccbbccccbbccg.",
  ".gcccccmmcccccg.",
  "..cccccccccccc..",
  "..dddddddddddd..",
  "...ddddsddddd...",
  ".....dddddd.....",
  ".......dd.......",
];

const SOL_COLORS = {
  c: "#fbf0d4", g: "#f0be4c", k: "#2e2a26", w: "#fffdf8",
  b: "#f2a08c", m: "#6b4f3a", d: "#4d4757", s: "#f6cf62",
};

/* moods: default open-eyed, "sleepy" = closed lids (used late at night) */
function solSprite(px, cls, mood) {
  let body = "", sprout = "", eyes = "";
  SOL_PIXMAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      let ch = row[x];
      if (ch === ".") continue;
      const isEye = ch === "k" || ch === "w";
      if (isEye && mood === "sleepy") ch = (y === 7) ? "c" : "k"; // lids down
      const rect = `<rect x="${x}" y="${y}" width="1" height="1" fill="${SOL_COLORS[ch]}"/>`;
      if (y < 3) sprout += rect;
      else if (isEye && mood !== "sleepy") {
        body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${SOL_COLORS.c}"/>`; // cream under the eye so blinking closes it
        eyes += rect;
      } else body += rect;
    }
  });
  return `<svg class="pixel-sol ${cls || ""}" viewBox="0 0 16 16" width="${px}" height="${px}" shape-rendering="crispEdges" aria-hidden="true">`
    + body
    + `<g class="px-sprout">${sprout}</g>`
    + (eyes ? `<g class="px-eye">${eyes}</g>` : "")
    + `</svg>`;
}

function solMoodNow() {
  const h = new Date().getHours();
  return (h >= 23 || h < 6) ? "sleepy" : "";
}

const SOL_AVATAR = `<span class="sol-avatar-px" aria-hidden="true">${solSprite(26, "px-idle")}</span>`;

/* small stroke icons - inline svg, themed via currentColor.
   Two visual languages: ORBIT (dark, sharp editorial) and CRYSTAL
   (light, rounded y2k bubbles) - the light mode is its own app. */
const ICONS_ORBIT = {
  today: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8.7 15l2.2 2.2 4.4-4.6"/>',
  sol: '<path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.2-3.4-.7L4 21l1.3-4.4A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
  projects: '<path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z"/><path d="M4 12.5l8 4.5 8-4.5"/><path d="M4 17l8 4.5 8-4.5" opacity=".4"/>',
  goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.7"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  education: '<path d="M3 8.5L12 4l9 4.5-9 4.5L3 8.5z"/><path d="M7 11v5c0 1.4 2.2 2.8 5 2.8s5-1.4 5-2.8v-5"/>',
  work: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.4 2"/>',
  notes: '<path d="M5 4h11l3 3v13H5V4z"/><path d="M16 4v3h3M8.5 11h7M8.5 14.5h5"/>',
  docs: '<path d="M6 3.5h9l3.5 3.5v13.5H6V3.5z"/><path d="M15 3.5V7h3.5M9 11h6M9 14h6M9 17h4"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M3.5 16l4.5-4 4 3.5 3-2.5 5.5 4"/>',
  pin: '<path d="M7 4h10v16l-5-4-5 4V4z"/>',
  wander: '<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2.1 4.9L8 16l2.1-4.9L15 9z"/>',
};

const ICONS_CRYSTAL = {
  today: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.1"/><path d="M12 1.8v2M12 20.2v2M1.8 12h2M20.2 12h2"/>',
  sol: '<rect x="3.4" y="4.4" width="17.2" height="12.8" rx="6.4"/><path d="M8.6 17.2L7.4 21l4.6-3.8"/><circle cx="9.3" cy="10.8" r="1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10.8" r="1" fill="currentColor" stroke="none"/>',
  tasks: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.4l2.6 2.6 5-5.6"/>',
  projects: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="3.4" r="1.7" fill="currentColor" stroke="none"/><circle cx="4.6" cy="16.4" r="1.7" fill="currentColor" stroke="none"/><circle cx="19.4" cy="16.4" r="1.7" fill="currentColor" stroke="none"/>',
  goals: '<path d="M6.5 21V4.2"/><path d="M6.5 5.2c2.6-1.7 5.2-1.7 7.7-.2s5 1.6 6.3.8v7.6c-1.3.8-3.8.7-6.3-.8s-5.1-1.5-7.7.2"/>',
  education: '<path d="M12 6.3C10 4.7 7.2 4 4 4.4v13.2c3.2-.4 6 .3 8 1.9 2-1.6 4.8-2.3 8-1.9V4.4C16.8 4 14 4.7 12 6.3z"/><path d="M12 6.3v13.2"/>',
  work: '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="5.2"/><path d="M13.1 6.8L9.6 12h4.4l-3.5 5.2"/>',
  notes: '<path d="M4.4 6.6A2.6 2.6 0 0 1 7 4h10a2.6 2.6 0 0 1 2.6 2.6v6.8L13.4 20H7a2.6 2.6 0 0 1-2.6-2.6V6.6z"/><path d="M13.4 20v-4a2.6 2.6 0 0 1 2.6-2.6h3.6"/>',
  docs: '<rect x="4.8" y="3.4" width="14.4" height="17.2" rx="3.2"/><path d="M8.6 8.6h6.8M8.6 12h6.8M8.6 15.4h4.2"/>',
  photo: '<rect x="3.4" y="6.4" width="17.2" height="13.2" rx="3.6"/><path d="M9 6.4l1.4-2.4h3.2L15 6.4"/><circle cx="12" cy="12.8" r="3.1"/>',
  pin: '<path d="M9.2 3.4h5.6l-.9 5.8 3.3 3.4H6.8l3.3-3.4-.9-5.8z"/><path d="M12 12.6V21"/>',
  wander: '<path d="M20.6 3.4L3.4 10.7l6.7 2.6 2.6 6.7 7.9-16.6z"/><path d="M10.1 13.3l4.3-4.3"/>',
};

function icon(name, cls) {
  const crystal = document.documentElement.getAttribute("data-theme") === "light";
  const set = crystal ? ICONS_CRYSTAL : ICONS_ORBIT;
  return `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${crystal ? 1.8 : 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${set[name] || set.today}</svg>`;
}

/* ---------------- helpers ---------------- */

function uid() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function isoOf(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayStr() { return isoOf(new Date()); }
function parseISO(s) {
  const p = String(s).split("-").map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function addDaysISO(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}
function fmtShortFromDate(d) {
  const yr = d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "";
  return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + yr;
}
function fmtShort(iso) { return iso ? fmtShortFromDate(parseISO(iso)) : ""; }
function fmtLongISO(iso) {
  const d = parseISO(iso);
  return WDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return fmtShortFromDate(new Date(ts));
}
function clock(ts) {
  const d = new Date(ts);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  return ((h % 12) || 12) + ":" + m + (h < 12 ? " am" : " pm");
}
function fmtHours(h) {
  const r = Math.round(h * 10) / 10;
  return r % 1 === 0 ? String(Math.round(r)) : String(r);
}
function labelOf(pairs, key) {
  const hit = pairs.find(p => p[0] === key);
  return hit ? hit[1] : key;
}
function snippet(body) {
  const s = String(body || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 84) : "Nothing here yet";
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------------- data & state ---------------- */

function defaultData() {
  return {
    // rev/savedAt guard multi-tab writes. rev must stay the FIRST key so
    // revOfRaw() can read it off the raw string without a full JSON.parse.
    rev: 0,
    savedAt: 0,
    version: 1,
    settings: {
      name: "Aman",
      theme: "auto",                 // auto | light | dark
      provider: "ollama",            // ollama | claude | offline
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "qwen3:8b",
      apiKey: "",
      model: "claude-opus-4-8",
      lastGreeted: "",
      sound: true,
    },
    game: { xp: 0, streak: 0, lastActiveDay: "", bestStreak: 0, logins: [] },
    tasks: [],
    projects: [],
    goals: [],
    education: [],
    worklog: [],
    notes: [],
    docs: [],
    chat: [],
  };
}

function firstRunData() {
  const d = defaultData();
  const now = Date.now();
  d.notes.push({
    id: uid(),
    title: "Welcome to Lyfe",
    body:
`Lyfe keeps everything in one calm place - and Sol keeps you company.

THE SHORT TOUR

Today - what needs you now, nothing more.
Sol - your companion. Just talk: "remind me to email prof tomorrow", "log 2h on research", "note: read Maass 1997", or plain "hi". Sol files things for you.
Tasks · Projects · Goals · Education · Work Log - the usual suspects, kept simple.
Notes - quick thoughts. Docs - longer writing.

GOOD TO KNOW

Everything lives in this browser only (localStorage). Export a backup from the sidebar now and then.
Sol works fully offline. Add an Anthropic API key in Settings and Sol becomes a real AI who understands anything - including things you paste from other AI chats.`,
    pinned: true,
    createdAt: now,
    updatedAt: now,
  });
  d.chat.push(
    { id: uid(), role: "sol", text: "hey, i'm sol ☀️", ts: now },
    { id: uid(), role: "sol", text: "i live here to help you keep track of life. just talk to me like you'd text a friend", ts: now + 1 },
    { id: uid(), role: "sol", text: "try \"remind me to email prof tomorrow\" or \"log 2h on research\", or just say hi", ts: now + 2 },
  );
  return d;
}

function normalize(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== "object") return base;
  for (const k of ["tasks", "projects", "goals", "education", "worklog", "notes", "docs", "chat"]) {
    base[k] = Array.isArray(raw[k]) ? raw[k].filter(x => x && typeof x === "object") : [];
  }
  base.chat = base.chat.map(message => Object.assign({}, message, {
    text: String(message.text || "").replace(/\s*[—–]\s*/g, ", "),
  }));
  if (raw.settings && typeof raw.settings === "object") {
    base.settings = Object.assign(base.settings, raw.settings);
  }
  // heal a bad model id that shipped briefly (qwen3.5:9b is not a real Ollama tag)
  if (base.settings.ollamaModel === "qwen3.5:9b") base.settings.ollamaModel = "qwen3:8b";
  // theme names moved from day/night to light/dark - carry old choices over
  if (base.settings.theme === "day") base.settings.theme = "light";
  if (base.settings.theme === "night") base.settings.theme = "dark";
  if (raw.game && typeof raw.game === "object") {
    base.game = Object.assign(base.game, raw.game);
  }
  // pre-rev payloads (and hand-rolled backups) count as revision 0
  if (typeof raw.rev === "number" && isFinite(raw.rev) && raw.rev >= 0) base.rev = Math.floor(raw.rev);
  if (typeof raw.savedAt === "number" && isFinite(raw.savedAt)) base.savedAt = raw.savedAt;
  return base;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return firstRunData();
    return normalize(JSON.parse(raw));
  } catch (e) {
    return firstRunData();
  }
}

/* multi-tab safety: every payload carries a revision counter. A tab may only
   write if it holds the latest revision - otherwise a stale tab (say, one that
   sat open for hours and then fired its beforeunload save) would overwrite
   newer data with its old in-memory snapshot. External writes are absorbed
   live by the storage listener near the bottom of this file. */
function revOfRaw(raw) {
  if (raw == null) return -1;              // nothing stored yet
  const m = /^\{"rev":(\d+)/.exec(raw);    // rev is always the first key
  return m ? Number(m[1]) : 0;             // no match = legacy pre-rev payload
}

function storedRev() {
  try { return revOfRaw(localStorage.getItem(STORAGE_KEY)); }
  catch (e) { return -1; }
}

function save(force) {
  try {
    const stored = storedRev();
    if (!force && stored > (state.data.rev || 0)) {
      // another tab wrote a newer revision we haven't absorbed yet; the
      // queued storage/visibility events will fold it in - don't clobber it
      return false;
    }
    state.data.rev = Math.max(state.data.rev || 0, stored) + 1;
    state.data.savedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    padDirty = false;
    return true;
  } catch (e) {
    toast("Could not save - storage may be full");
    return false;
  }
}

const state = {
  data: loadData(),
  view: "today",
  taskStatusFilter: "open",
  taskAreaFilter: "all",
  eduFilter: "all",
  noteId: null,
  noteQuery: "",
  docId: null,
  docQuery: "",
  doneOpen: false,
  unread: 0,
  wanderIndex: Math.floor(Math.random() * PLACES.length),
  factIndex: Math.floor(Math.random() * FACTS.length),
};

/* light = CRYSTAL, dark = ORBIT, auto = by the clock.
   ("day"/"night" still resolve for any backup written before the rename.) */
function autoThemeMode() {
  const h = new Date().getHours();
  return (h >= 7 && h < 18) ? "light" : "dark";
}
function resolvedTheme() {
  const set = state.data.settings.theme || "auto";
  if (set === "auto") return autoThemeMode();
  if (set === "day" || set === "light") return "light";
  return "dark"; // night / dark
}
function applyTheme() {
  const mode = resolvedTheme();
  document.documentElement.setAttribute("data-theme", mode);
  // keep the browser chrome (address bar / PWA titlebar) in step with the theme
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "light" ? "#e9f1fb" : "#050505");
}

/* ---------------- generic ui ---------------- */

function openModal(inner) {
  const root = document.getElementById("modal-root");
  root.innerHTML =
    `<div class="overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
  setTimeout(() => {
    const el = root.querySelector("input:not([type=hidden]), textarea, select");
    if (el) el.focus();
  }, 0);
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  confirmCb = null;
}

let confirmCb = null;
function confirmDialog(message, cb, yesLabel) {
  confirmCb = cb;
  openModal(
    `<div class="modal-head"><h3>Are you sure?</h3></div>
     <p class="confirm-msg">${esc(message)}</p>
     <div class="modal-actions">
       <button type="button" class="btn" data-action="modal-close">Cancel</button>
       <button type="button" class="btn btn-danger" data-action="confirm-yes">${esc(yesLabel || "Delete")}</button>
     </div>`
  );
}

let toastTimer = null;
function toast(msg) {
  const root = document.getElementById("toast-root");
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ""; }, 2200);
}

/* ---------------- Sound FX module (Web Audio API, zero files) ---------------- */
const SFX = (() => {
  let _ctx = null;
  function ctx() {
    if (!_ctx || _ctx.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  }
  function ok() { return state.data.settings.sound !== false && !!ctx(); }

  function play(fn) {
    if (!ok()) return;
    try { fn(ctx()); } catch (e) { /* audio is a bonus, never a blocker */ }
  }

  /* ascending triad - the satisfying task complete chime */
  function finish() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.55);
      [392, 587, 784].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = i === 2 ? "sine" : "triangle"; o.frequency.value = f;
        o.connect(g); o.start(c.currentTime + i * 0.06); o.stop(c.currentTime + 0.56);
      });
    });
  }

  /* soft pop/tick for check/toggle */
  function tick() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 1200;
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.08);
    });
  }

  /* subtle mechanical click for buttons */
  function click() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.06, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
      const o = c.createOscillator(); o.type = "square"; o.frequency.value = 800;
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.04);
    });
  }

  /* soft whoosh for navigation */
  function nav() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
      const bufSize = c.sampleRate * 0.2;
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = c.createBufferSource(); noise.buffer = buf;
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2000;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
      noise.connect(hp); hp.connect(lp); lp.connect(g);
      noise.start(c.currentTime); noise.stop(c.currentTime + 0.18);
    });
  }

  /* bright ding for adding a new item */
  function ding() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.10, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 880;
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.4);
      const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = 1318.5;
      o2.connect(g); o2.start(c.currentTime + 0.05); o2.stop(c.currentTime + 0.35);
    });
  }

  /* low descending tone for delete */
  function del() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
      const o = c.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(440, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.3);
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.3);
    });
  }

  /* soft rising chime for modal open */
  function modalOpen() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(520, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(780, c.currentTime + 0.12);
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.25);
    });
  }

  /* soft falling note for modal close */
  function modalClose() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.05, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(680, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.18);
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.2);
    });
  }

  /* quick swoosh for sending a message */
  function send() {
    play(c => {
      const g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(600, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(1400, c.currentTime + 0.12);
      o.connect(g); o.start(c.currentTime); o.stop(c.currentTime + 0.15);
    });
  }

  /* alarmy-style aggressive alarm - alternating tones, looping until stopped */
  let _alarmOscs = [];
  let _alarmGain = null;
  let _alarmTimer = null;
  function alarmStart() {
    alarmStop();
    if (!ok()) return;
    const c = ctx();
    _alarmGain = c.createGain();
    _alarmGain.connect(c.destination);
    _alarmGain.gain.setValueAtTime(0.22, c.currentTime);
    function burst() {
      if (!_alarmGain) return;
      const now = c.currentTime;
      for (let i = 0; i < 8; i++) {
        const o1 = c.createOscillator(); o1.type = "square";
        o1.frequency.value = i % 2 === 0 ? 880 : 1100;
        o1.connect(_alarmGain);
        o1.start(now + i * 0.12);
        o1.stop(now + i * 0.12 + 0.1);
        _alarmOscs.push(o1);
      }
      _alarmTimer = setTimeout(burst, 1200);
    }
    burst();
  }
  function alarmStop() {
    clearTimeout(_alarmTimer); _alarmTimer = null;
    _alarmOscs.forEach(o => { try { o.stop(); } catch(e) {} });
    _alarmOscs = [];
    _alarmGain = null;
  }

  return { finish, tick, click, nav, ding, del, modalOpen, modalClose, send, alarmStart, alarmStop };
})();

function playFinishTone() { SFX.finish(); }

function launchCompletion(title) {
  const old = document.getElementById("completion-fx");
  if (old) old.remove();
  const fx = document.createElement("div");
  fx.id = "completion-fx";
  fx.setAttribute("aria-live", "polite");
  fx.innerHTML = `<div class="complete-reticle">
      <i></i><i></i><i></i>
      <div class="complete-check">✓</div>
    </div>
    <div class="complete-copy"><b>LOCKED IN</b><span>${esc(title || "Task complete")}</span></div>
    <div class="complete-particles">${Array.from({ length: 18 }, (_, i) =>
      `<i style="--i:${i};--x:${Math.round(Math.cos(i * 1.9) * (80 + (i % 5) * 18))}px;--y:${Math.round(Math.sin(i * 1.9) * (70 + (i % 4) * 20))}px"></i>`
    ).join("")}</div>`;
  document.body.appendChild(fx);
  playFinishTone();
  setTimeout(() => fx.remove(), 1650);
}

/* ---------------- click sounds: tiny satisfying ticks per action ---------------- */

let sfxCtx = null;
function ensureSfxCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  sfxCtx = sfxCtx || new AC();
  if (sfxCtx.state === "suspended") { try { sfxCtx.resume(); } catch (e) { /* needs gesture */ } }
  return sfxCtx;
}

function sfxClick(kind) {
  if (state.data.settings.sound === false) return;
  try {
    const ctx = ensureSfxCtx();
    if (!ctx) return;
    const cfg = {
      tap:   [1150, 0.035, "triangle", 0.040, 1.15],
      nav:   [660,  0.055, "sine",     0.050, 1.25],
      check: [880,  0.070, "triangle", 0.055, 1.30],
      open:  [520,  0.060, "sine",     0.045, 1.22],
      close: [430,  0.050, "sine",     0.038, 0.78],
      chip:  [980,  0.040, "square",   0.028, 1.18],
    }[kind] || [900, 0.04, "triangle", 0.04, 1.15];
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(cfg[3], t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[1] + 0.02);
    const o = ctx.createOscillator();
    o.type = cfg[2];
    o.frequency.setValueAtTime(cfg[0], t);
    o.frequency.exponentialRampToValueAtTime(cfg[0] * cfg[4], t + cfg[1]);
    o.connect(g);
    o.start(t);
    o.stop(t + cfg[1] + 0.03);
  } catch (e) { /* sound is a bonus, never a blocker */ }
}

/* ---------------- IMPORTANT tasks: alarm that won't quit until you answer ---------------- */

let alarmTask = null;
let alarmTimer = null;

function taskDueMs(t) {
  if (!t.due) return null;
  const p = String(t.due).split("-").map(Number);
  let hh = 0, mm = 0;
  if (t.dueTime && /^\d{1,2}:\d{2}$/.test(t.dueTime)) {
    const q = t.dueTime.split(":").map(Number);
    hh = q[0]; mm = q[1];
  }
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, hh, mm, 0, 0).getTime();
}

function alarmBurst() {
  if (state.data.settings.sound === false) return;
  try {
    const ctx = ensureSfxCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    [880, 660, 880, 660].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(g);
      o.start(t + i * 0.17);
      o.stop(t + i * 0.17 + 0.15);
    });
  } catch (e) { /* still shows the overlay */ }
}

function startAlarm(task) {
  if (alarmTask) return; // one siren at a time; the next fires after ack
  alarmTask = task;
  const old = document.getElementById("alarm-fx");
  if (old) old.remove();
  const fx = document.createElement("div");
  fx.id = "alarm-fx";
  fx.setAttribute("role", "alertdialog");
  fx.innerHTML = `
    <div class="alarm-box">
      <div class="alarm-flag">⚑ IMPORTANT · NOW</div>
      <h2>${esc(task.title)}</h2>
      <p>${esc(fmtShort(task.due))}${task.dueTime ? " · " + esc(task.dueTime) : ""} - this won't stop until you answer</p>
      <div class="alarm-actions">
        <button class="btn btn-primary" data-action="alarm-ack" data-id="${esc(task.id)}">I'M ON IT ✓</button>
        <button class="btn" data-action="alarm-done" data-id="${esc(task.id)}">ALREADY DONE</button>
      </div>
    </div>`;
  document.body.appendChild(fx);
  alarmBurst();
  alarmTimer = setInterval(alarmBurst, 1500);
}

function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = null;
  alarmTask = null;
  const fx = document.getElementById("alarm-fx");
  if (fx) fx.remove();
}

function checkAlarms() {
  if (alarmTask) return;
  const now = Date.now();
  const t = state.data.tasks.find(x =>
    x.important && x.status !== "done" && !x.alarmAck &&
    taskDueMs(x) !== null && taskDueMs(x) <= now);
  if (t) startAlarm(t);
}

/* ---------------- shared fragments ---------------- */

function pageHead(h1, actionsHtml, kicker) {
  return `<header class="page-head">
    <div>
      ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ""}
      <h1>${h1}</h1>
    </div>
    ${actionsHtml ? `<div class="page-actions">${actionsHtml}</div>` : ""}
  </header>`;
}

function emptyState(msg, ic) {
  return `<div class="empty">${ic ? icon(ic, "empty-ic") : ""}<em>${esc(msg)}</em></div>`;
}

function dueLabel(due) {
  if (!due) return "";
  const t = todayStr();
  let cls = "", txt = fmtShort(due);
  if (due < t) { cls = "overdue"; txt = "overdue · " + txt; }
  else if (due === t) { cls = "today"; txt = "today"; }
  else if (due === addDaysISO(t, 1)) { txt = "tomorrow"; }
  return `<span class="due ${cls}">${esc(txt)}</span>`;
}

function bar(pct, fillClass) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="bar-row">
    <div class="bar"><i class="${fillClass || ""}" style="width:${p}%"></i></div>
    <span class="bar-pct">${p}%</span>
  </div>`;
}

function taskRow(t, opts) {
  const o = opts || {};
  const done = t.status === "done";
  const timeTag = (!done && t.dueTime) ? `<span class="due-time">${esc(t.dueTime)}</span>` : "";
  const side = done
    ? (t.completedAt ? `<span class="due">${esc(fmtShortFromDate(new Date(t.completedAt)))}</span>` : "<span></span>")
    : (o.hideDue ? `<span>${timeTag}</span>` : `<span>${dueLabel(t.due) || ""}${timeTag}</span>`);
  return `<li class="task ${done ? "done" : ""} ${!done && t.important ? "important" : ""}">
    <button class="check" data-action="toggle-task" data-id="${esc(t.id)}"
      title="${done ? "Mark as not done" : "Mark as done"}" aria-label="Toggle task">${done ? "✓" : ""}</button>
    <div class="task-title">${!done && t.important ? `<span class="imp-flag" title="Important - will alarm">⚑</span>` : ""}${esc(t.title)}${!done && t.priority === "High" ? `<span class="prio-flag" title="High priority">!</span>` : ""}</div>
    ${side}
    <span class="row-actions">
      ${!done && t.due && t.due < todayStr() ? `<button class="icon-btn" data-action="snooze-task" data-id="${esc(t.id)}" title="Push to tomorrow">↷</button>` : ""}
      <button class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" title="Edit">✎</button>
      <button class="icon-btn" data-action="delete-task" data-id="${esc(t.id)}" title="Delete">✕</button>
    </span>
  </li>`;
}

function taskCmp(a, b) {
  const ad = a.due || "9999-12-31", bd = b.due || "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const ap = PRIO_W[a.priority] != null ? PRIO_W[a.priority] : 1;
  const bp = PRIO_W[b.priority] != null ? PRIO_W[b.priority] : 1;
  if (ap !== bp) return ap - bp;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

function weekRange() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [isoOf(mon), isoOf(sun)];
}
function weekLog() {
  const [a, b] = weekRange();
  return state.data.worklog.filter(e => e.date >= a && e.date <= b);
}
function weekHours() {
  return weekLog().reduce((s, e) => s + (typeof e.hours === "number" ? e.hours : 0), 0);
}

/* ---------------- view: today ---------------- */

function viewToday() {
  const d = state.data;
  const t = todayStr();
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = (d.settings.name || "").trim();

  const open = d.tasks.filter(x => x.status !== "done");
  const overdue = open.filter(x => x.due && x.due < t).sort(taskCmp);
  const dueToday = open.filter(x => x.due === t).sort(taskCmp);
  const doneToday = d.tasks
    .filter(x => x.status === "done" && x.completedAt && isoOf(new Date(x.completedAt)) === t)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const activeProjects = d.projects.filter(p => p.status === "active")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
  const recentNotes = d.notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);

  const wh = weekHours();

  const calm = `<section class="panel tilt calm-card">
    <img class="calm-img" alt="today's photograph" loading="lazy"
      src="https://picsum.photos/seed/lyfe-${t}/640/400"
      onerror="this.closest('.calm-card').style.display='none'">
    <div class="calm-cap">a moment of calm · new each day</div>
  </section>`;

  const dayList = (overdue.length || dueToday.length || doneToday.length)
    ? `<ul class="task-list">${
        overdue.map(x => taskRow(x)).join("")}${
        dueToday.map(x => taskRow(x, { hideDue: true })).join("")}${
        doneToday.map(x => taskRow(x, { hideDue: true })).join("")}</ul>`
    : emptyState("Nothing on your plate today.");

  const projList = activeProjects.length
    ? activeProjects.map(p => `
        <div class="mini-row">
          <div class="mini-top"><span class="mini-name">${esc(p.name)}</span></div>
          ${bar(p.progress || 0)}
        </div>`).join("")
    : emptyState("No projects in motion.");

  const noteList = recentNotes.length
    ? recentNotes.map(n => `
        <div class="mini-row mini-note" data-action="open-note" data-id="${esc(n.id)}">
          <div class="mini-top">
            <span class="mini-name">${esc((n.title || "").trim() || "Untitled")}${n.pinned ? ` <span class="pin-mark">${icon("pin")}</span>` : ""}</span>
            <span class="mini-time">${esc(timeAgo(n.updatedAt))}</span>
          </div>
        </div>`).join("")
    : emptyState("No notes yet.");

  const li = levelInfo();
  const level = li.lvl + 1;
  const score = li.pct;
  const finished = d.tasks.filter(x => x.status === "done").length;
  const streak = (d.game && d.game.streak) || 0;
  // daily tracker: today's completed vs a gentle goal of 3
  const doneN = doneToday.length;
  const goalN = Math.max(3, doneN);
  const ringPct = Math.min(100, Math.round(doneN / goalN * 100));
  const dailyRing = `<div class="daily-ring-wrap">
    <div class="daily-ring" style="--p:${ringPct}"><span>${doneN}<small>/${goalN}</small></span></div>
    <div class="daily-ring-meta"><span class="eyebrow">TODAY</span><b>${doneN} done</b><p>${streak > 0 ? "▲ " + streak + " day streak" : "start a streak today"}</p></div>
  </div>`;

  // the two identities are two different buildings on the same data.
  // CRYSTAL (light): glass showroom - 3D disc hero, bento deck, holo endcap.
  if (resolvedTheme() === "light") {
    const learning = d.education.filter(x => x.status === "in-progress").length;
    const sleepy = solMoodNow() === "sleepy";
    return `<div class="cx-stage">
    <section class="cx-hero" data-reveal>
      <div class="cx-hero-copy">
        <div class="cx-kicker home-index">LYFE ::CRYSTAL • ${esc(fmtLongISO(t))}</div>
        <h1 class="cx-title">Good ${part}${name ? ",<br>" + esc(name) : "<br>friend"}<span class="blink-dot">.</span></h1>
        <p class="cx-deck">${open.length
          ? `<b>${open.length} open loop${open.length === 1 ? "" : "s"}</b> in orbit - everything else is handled.`
          : `Nothing waiting on you. <b>Protect that feeling.</b>`}</p>
        <div class="cx-cta">
          <button class="btn btn-primary cx-btn-big" data-action="new-task">+ capture</button>
          <button class="btn cx-btn-big" data-action="nav" data-view="sol">${icon("sol")} talk to Sol</button>
        </div>
      </div>

      <div class="cx-hero-disc" aria-hidden="true">
        <div class="cx-float">
          <i class="cx-petal p1"></i><i class="cx-petal p2"></i><i class="cx-petal p3"></i>
          <div class="cx-core">
            <i class="cx-core-ring rb"></i>
            <i class="cx-core-orb"></i>
            <i class="cx-core-ring rf"></i>
            <i class="cx-core-orbiter"><i></i></i>
            <span class="cx-core-badge">::2K</span>
            <span class="cx-core-label">personal system · crystal</span>
          </div>
          <span class="cx-glint g1">✦</span><span class="cx-glint g2">✧</span><span class="cx-glint g3">✦</span>
        </div>
      </div>

      <div class="cx-stats">
        <button class="cx-stat" data-action="nav" data-view="tasks"><b>${overdue.length + dueToday.length}</b><span>due now</span></button>
        <button class="cx-stat" data-action="nav" data-view="projects"><b>${activeProjects.length}</b><span>projects live</span></button>
        <button class="cx-stat" data-action="nav" data-view="work"><b>${fmtHours(wh)}h</b><span>deep work</span></button>
        <button class="cx-stat" data-action="nav" data-view="education"><b>${learning}</b><span>learning</span></button>
        <button class="cx-stat cx-stat-sol" data-action="nav" data-view="sol">${solSprite(30, "px-idle", solMoodNow())}<span>${sleepy ? "sol · up late" : "sol · online"}</span></button>
      </div>
    </section>

    <div class="ticker" aria-hidden="true">
      <div>WELCOME.. ::2K • CAPTURE IT • MOVE IT • LEARN IT • REMEMBER IT • LIVE IT • WELCOME.. ::2K • CAPTURE IT • MOVE IT • LEARN IT • REMEMBER IT • LIVE IT • </div>
    </div>

    <section class="cx-bento">
      <section class="panel tilt cx-tile cx-queue">
        <div class="panel-head">
          <div><span class="eyebrow">TODAY'S QUEUE</span><h2>Do the next thing.</h2></div>
          <span class="queue-count">${overdue.length + dueToday.length} live</span>
        </div>
        <div class="panel-body">
          <form class="quick-add command-add" data-form="quick-task-today">
            <span>+</span>
            <input type="text" id="qa-title" name="title" maxlength="200" placeholder="Type it before it disappears…" autocomplete="off">
            <button class="btn btn-primary btn-sm" type="submit">LOCK</button>
          </form>
          ${dayList}
        </div>
      </section>

      <section class="panel tilt cx-tile cx-level">
        <span class="eyebrow">${esc(li.name.toUpperCase())} · ${li.xp} XP</span>
        <div class="cx-level-row">
          <div class="level-orb" style="--score:${score * 3.6}deg"><span>LVL</span><b>${String(level).padStart(2, "0")}</b></div>
          <div class="cx-level-copy"><b>${finished}</b><p>things finished · ${li.need - li.into} XP to level ${level + 1}</p></div>
        </div>
      </section>

      <section class="panel tilt cx-tile cx-ring">${dailyRing}</section>

      <section class="panel tilt cx-tile heat-card cx-heat">
        <span class="eyebrow">LAST 30 DAYS</span>
        ${heat30()}
        <p class="heat-cap">brighter = more finished · dot = you showed up</p>
      </section>

      <section class="panel tilt cx-tile cx-projects">
        <div class="panel-head"><h2>Projects</h2><button class="linklike" data-action="nav" data-view="projects">OPEN ALL ↗</button></div>
        <div class="panel-body">${projList}</div>
      </section>

      <section class="panel tilt cx-tile cx-notes">
        <div class="panel-head"><h2>Memory bank</h2><button class="linklike" data-action="nav" data-view="notes">OPEN NOTES ↗</button></div>
        <div class="panel-body">${noteList}</div>
      </section>

      <section class="panel tilt cx-tile mini-sol-card cx-solcard">
        <span class="eyebrow">SOL SAYS</span>
        <h2>${overdue.length ? "one overdue thing. no drama, just pick it up." : "your slate is clear. protect that feeling."}</h2>
        <button class="btn" data-action="nav" data-view="sol">reply to Sol</button>
      </section>
    </section>

    <section class="panel tilt calm-card cx-moment">
      <img class="calm-img" alt="today's photograph" loading="lazy"
        src="https://picsum.photos/seed/lyfe-${t}/1200/400"
        onerror="this.closest('.calm-card').style.display='none'">
      <div class="calm-cap">a moment of calm · new each day</div>
    </section>

    <section class="cx-endcap" data-reveal>
      <i class="cx-endcap-disc" aria-hidden="true"></i>
      <span class="cx-endcap-kicker">YOU ARE NOT BEHIND.</span>
      <h2>You are here.<br>That is enough to begin.</h2>
      <button class="btn btn-primary" data-action="nav" data-view="wander">take a detour ${icon("wander")}</button>
    </section>
  </div>`;
  }

  // ORBIT (dark): the cinematic control room, unchanged.
  return `<div class="home-stage">
    <section class="home-intro">
      <div class="home-index">LYFE / ${String(new Date().getMonth() + 1).padStart(2, "0")}.${String(new Date().getDate()).padStart(2, "0")}</div>
      <div class="home-title-row">
        <h1>Good ${part}${name ? ", " + esc(name) : ""}<span class="blink-dot">.</span></h1>
        <div class="home-actions">
          <button class="btn ghost-pill" data-action="nav" data-view="sol">${icon("sol")} talk to Sol</button>
          <button class="btn btn-primary punch-pill" data-action="new-task">+ capture</button>
        </div>
      </div>
      <p class="home-deck">Everything important, held lightly. <span>No clutter. No guilt.</span></p>
    </section>

    <section class="cosmos-hero">
      <div class="grid-scene" aria-hidden="true">
        <div class="sky-body" id="sky-body"><i class="sky-crater c1"></i><i class="sky-crater c2"></i><i class="sky-crater c3"></i></div>
        <div class="grid-glow" id="grid-glow-line"></div>
        <div class="grid-floor"></div>
        <div class="scanlines"></div>
      </div>
      <div class="cosmos-top"><span>PERSONAL SYSTEM / LIVE</span><span>${esc(fmtLongISO(t))}</span></div>
      <div class="cosmos-copy">
        <span class="signal-dot"></span>
        <p>YOUR DAY, RIGHT NOW</p>
        <h2>${open.length}<small> open loop${open.length === 1 ? "" : "s"}</small></h2>
      </div>
      <button class="sol-chip" data-action="nav" data-view="sol" aria-label="Open Sol">
        ${solSprite(42, "px-idle", solMoodNow())}
        <span class="sol-chip-txt">
          <span class="sol-chip-main"><span class="live-dot"></span>SOL · ${solMoodNow() === "sleepy" ? "UP LATE WITH YOU" : "ONLINE"}</span>
          <span class="sol-chip-sub">tap to talk to your companion</span>
        </span>
      </button>
      <div class="orbit-dock">
        <button data-action="nav" data-view="tasks"><b>${overdue.length + dueToday.length}</b><span>due now</span></button>
        <button data-action="nav" data-view="projects"><b>${activeProjects.length}</b><span>projects</span></button>
        <button data-action="nav" data-view="work"><b>${fmtHours(wh)}h</b><span>deep work</span></button>
        <button data-action="nav" data-view="education"><b>${d.education.filter(x => x.status === "in-progress").length}</b><span>learning</span></button>
      </div>
      <div class="scroll-cue">SCROLL <i></i></div>
    </section>

    <div class="ticker" aria-hidden="true">
      <div>CAPTURE IT • MOVE IT • LEARN IT • REMEMBER IT • LIVE IT • CAPTURE IT • MOVE IT • LEARN IT • REMEMBER IT • LIVE IT •</div>
    </div>

    <section class="home-grid">
      <div class="home-focus">
        <div class="section-number">01 / NOW</div>
        <section class="panel tilt home-task-panel">
          <div class="panel-head">
            <div><span class="eyebrow">TODAY'S QUEUE</span><h2>Do the next thing.</h2></div>
            <span class="queue-count">${overdue.length + dueToday.length} live</span>
          </div>
          <div class="panel-body">
            <form class="quick-add command-add" data-form="quick-task-today">
              <span>+</span>
              <input type="text" id="qa-title" name="title" maxlength="200" placeholder="Type it before it disappears…" autocomplete="off">
              <button class="btn btn-primary btn-sm" type="submit">LOCK</button>
            </form>
            ${dayList}
          </div>
        </section>
      </div>

      <div class="home-side">
        <div class="section-number">02 / SIGNAL</div>
        <section class="panel tilt level-card">
          <div class="level-orb" style="--score:${score * 3.6}deg"><span>LVL</span><b>${String(level).padStart(2, "0")}</b></div>
          <div><span class="eyebrow">${esc(li.name.toUpperCase())} · ${li.xp} XP</span><h2>${finished} things finished</h2><p>${li.need - li.into} XP to level ${level + 1}.</p></div>
        </section>
        <section class="panel tilt">${dailyRing}</section>
        <section class="panel tilt heat-card">
          <span class="eyebrow">LAST 30 DAYS</span>
          ${heat30()}
          <p class="heat-cap">brighter = more finished · dot = you showed up</p>
        </section>
        ${calm}
      </div>
    </section>

    <section class="home-wide">
      <div class="section-number">03 / IN MOTION</div>
      <div class="wide-columns">
        <section class="panel tilt">
          <div class="panel-head"><h2>Projects</h2><button class="linklike" data-action="nav" data-view="projects">OPEN ALL ↗</button></div>
          <div class="panel-body">${projList}</div>
        </section>
        <section class="panel tilt">
          <div class="panel-head"><h2>Memory bank</h2><button class="linklike" data-action="nav" data-view="notes">OPEN NOTES ↗</button></div>
          <div class="panel-body">${noteList}</div>
        </section>
        <section class="panel tilt mini-sol-card">
          <span class="eyebrow">SOL SAYS</span>
          <h2>${overdue.length ? "one overdue thing. no drama, just pick it up." : "your slate is clear. protect that feeling."}</h2>
          <button class="btn" data-action="nav" data-view="sol">reply to Sol</button>
        </section>
      </div>
    </section>

    <section class="home-endcap">
      <span>YOU ARE NOT BEHIND.</span>
      <h2>You are here.<br>That is enough to begin.</h2>
      <button class="btn btn-primary" data-action="nav" data-view="wander">take a detour ${icon("wander")}</button>
    </section>
  </div>`;
}

/* ---------------- view: wander ---------------- */

function viewWander() {
  const place = PLACES[state.wanderIndex % PLACES.length];
  const fact = FACTS[state.factIndex % FACTS.length];
  const [name, country, blurb, wikiTitle] = place;
  const crystal = resolvedTheme() === "light";
  return `<div class="wander-page">
    ${pageHead("Wander",
      `<button class="btn" data-action="save-wander">keep this</button>
       <button class="btn btn-primary" data-action="new-wander">somewhere else ↗</button>`,
      "a five minute window")}
    <section class="wander-hero tilt" data-wiki="${esc(wikiTitle)}">
      <div class="wander-loading" aria-hidden="true">
        <i></i>
        <span class="wl-tuning">${crystal ? "TUNING SIGNAL.." : "ACQUIRING TRANSMISSION…"}</span>
        <span class="wl-lost">${crystal ? "NO SIGNAL - IMAGINE IT.." : "SIGNAL LOST - IMAGINE IT"}</span>
      </div>
      <img id="wander-photo" alt="${esc(name)}, ${esc(country)}">
      <div class="wander-scan" aria-hidden="true"></div>
      <div class="wander-meta"><span>${crystal ? "DISC" : "PLACE"} ${String(state.wanderIndex + 1).padStart(3, "0")} / ${PLACES.length}</span><span>${crystal ? "COLOR COLLECTION • MD 80" : "RANDOM TRANSMISSION"}</span></div>
      <div class="wander-copy">
        <span>${esc(country)}</span>
        <h1>${esc(name)}</h1>
        <p>${esc(blurb)}</p>
      </div>
      <div class="wander-coords">LOOK UP • BREATHE OUT</div>
    </section>
    <section class="fact-panel">
      <span class="eyebrow">STRANGE BUT TRUE / ${String(state.factIndex + 1).padStart(2, "0")}</span>
      <p>${esc(fact)}</p>
      <button class="linklike" data-action="new-fact">another fact ↻</button>
    </section>
    <div class="wander-footer">100+ places. zero itinerary. just enough world to wake your attention back up. <span class="wander-tip">tip: ← → for another place</span></div>
  </div>`;
}

/* the photo arrives behind a clean tuning screen and fades in -
   no placeholder art, no flash of the previous place */
async function loadWanderPhoto() {
  const img = document.getElementById("wander-photo");
  const hero = document.querySelector(".wander-hero");
  if (!img || !hero) return;
  try {
    const title = hero.dataset.wiki;
    const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title));
    if (!res.ok) throw new Error("no summary");
    const data = await res.json();
    const src = data.originalimage && data.originalimage.source || data.thumbnail && data.thumbnail.source;
    if (!src) throw new Error("no image");
    img.onload = () => { if (hero.isConnected) hero.classList.add("img-ready"); };
    img.onerror = () => { if (hero.isConnected) hero.classList.add("img-fallback"); };
    if (img.isConnected) img.src = src;
  } catch (e) {
    if (hero.isConnected) hero.classList.add("img-fallback");
  }
}

/* ---------------- view: tasks ---------------- */

function viewTasks() {
  const t = todayStr();
  const areaOk = x => state.taskAreaFilter === "all" || x.area === state.taskAreaFilter;
  const all = state.data.tasks.filter(areaOk);
  const open = all.filter(x => x.status !== "done");
  const done = all.filter(x => x.status === "done")
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const groups = [
    ["Overdue",  open.filter(x => x.due && x.due < t).sort(taskCmp), "g-overdue"],
    ["Today",    open.filter(x => x.due === t).sort(taskCmp), ""],
    ["Upcoming", open.filter(x => x.due && x.due > t).sort(taskCmp), ""],
    ["Someday",  open.filter(x => !x.due).sort(taskCmp), ""],
  ];

  const filterBar = `<div class="filter-bar">
    ${[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([v, l]) =>
      `<button class="filter-chip ${state.taskStatusFilter === v ? "active" : ""}" data-action="task-status" data-v="${v}">${l}</button>`
    ).join("")}
    <select id="task-area-filter" aria-label="Filter by area">
      <option value="all" ${state.taskAreaFilter === "all" ? "selected" : ""}>All areas</option>
      ${AREAS.map(a => `<option ${state.taskAreaFilter === a ? "selected" : ""}>${a}</option>`).join("")}
    </select>
  </div>`;

  const quickAdd = `<form class="quick-add" data-form="quick-task">
    <input type="text" id="qa-title" name="title" maxlength="200" placeholder="Add a task…" autocomplete="off">
    <input type="date" name="due" title="Due date (optional)">
    <button class="btn btn-primary btn-sm" type="submit">Add</button>
  </form>`;

  let body = "";
  if (state.taskStatusFilter === "done") {
    body = done.length
      ? `<ul class="task-list">${done.slice(0, 100).map(x => taskRow(x)).join("")}</ul>`
      : emptyState("Nothing finished yet. Soon.");
  } else {
    const anyOpen = groups.some(g => g[1].length);
    body = anyOpen
      ? groups.map(([label, list, cls]) => list.length
          ? `<div class="group-h ${cls}"><span>${label}</span><span class="g-count">${list.length}</span></div>
             <ul class="task-list">${list.map(x => taskRow(x, { hideDue: label === "Today" })).join("")}</ul>`
          : "").join("")
      : emptyState("All clear. Enjoy it.");
    if (done.length) {
      body += `<details class="done-details" id="done-details" ${state.doneOpen ? "open" : ""}>
        <summary>Done / ${done.length}</summary>
        <ul class="task-list">${done.slice(0, 50).map(x => taskRow(x)).join("")}</ul>
      </details>`;
    }
  }

  return pageHead("Tasks", `<button class="btn btn-primary" data-action="new-task">New task</button>`)
    + quickAdd + filterBar + body;
}

/* ---------------- view: projects ---------------- */

function viewProjects() {
  const list = state.data.projects.slice().sort((a, b) => {
    const s = (PROJ_ORDER[a.status] || 0) - (PROJ_ORDER[b.status] || 0);
    if (s) return s;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const cards = list.map(p => {
    const linked = state.data.tasks.filter(x => x.projectId === p.id);
    const linkedDone = linked.filter(x => x.status === "done").length;
    const footL = linked.length ? `${linkedDone}/${linked.length} tasks done` : "";
    const footR = p.targetDate ? "aim · " + esc(fmtShort(p.targetDate)) : "";
    return `<div class="card tilt">
      <div class="card-top">
        <h3>${esc(p.name)}</h3>
        <span class="row-actions">
          <button class="icon-btn" data-action="edit-project" data-id="${esc(p.id)}" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete-project" data-id="${esc(p.id)}" title="Delete">✕</button>
        </span>
      </div>
      ${p.status !== "active" ? `<span class="st st-${esc(p.status)}">${esc(labelOf(PROJECT_STATUSES, p.status))}</span>` : ""}
      ${p.description ? `<div class="card-desc">${esc(p.description)}</div>` : ""}
      ${bar(p.progress || 0, p.status === "completed" ? "fill-green" : "")}
      ${(footL || footR) ? `<div class="card-foot"><span>${footL}</span><span>${footR}</span></div>` : ""}
    </div>`;
  }).join("");

  return pageHead("Projects", `<button class="btn btn-primary" data-action="new-project">New project</button>`)
    + (list.length ? `<div class="cards">${cards}</div>` : emptyState("Nothing in the works. Start something."));
}

/* ---------------- view: goals ---------------- */

function viewGoals() {
  const list = state.data.goals.slice().sort((a, b) => {
    const s = (a.status === "achieved" ? 1 : 0) - (b.status === "achieved" ? 1 : 0);
    if (s) return s;
    return (a.horizon || "9999") < (b.horizon || "9999") ? -1 : 1;
  });

  const cards = list.map(g => {
    const ms = g.milestones || [];
    const doneCt = ms.filter(m => m.done).length;
    const pct = g.status === "achieved" ? 100 : (ms.length ? (doneCt / ms.length) * 100 : 0);
    return `<div class="card goal-card tilt">
      <div class="card-top">
        <h3>${esc(g.title)}</h3>
        <span class="row-actions">
          <button class="icon-btn" data-action="edit-goal" data-id="${esc(g.id)}" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete-goal" data-id="${esc(g.id)}" title="Delete">✕</button>
        </span>
      </div>
      ${g.why ? `<div class="goal-why">“${esc(g.why)}”</div>` : ""}
      ${(g.status === "achieved" || g.horizon) ? `<div class="card-meta">
        ${g.status === "achieved" ? `<span class="st st-achieved">Achieved</span>` : ""}
        ${g.horizon ? `<span class="due">by ${esc(fmtShort(g.horizon))}</span>` : ""}
      </div>` : ""}
      ${ms.length ? bar(pct) : ""}
      ${ms.length ? `<ul class="ms-list">${ms.map(m => `
        <li class="${m.done ? "done" : ""}">
          <button class="check check-sm" data-action="toggle-milestone" data-goal="${esc(g.id)}" data-mid="${esc(m.id)}"
            aria-label="Toggle milestone">${m.done ? "✓" : ""}</button>
          <span>${esc(m.text)}</span>
        </li>`).join("")}</ul>` : ""}
    </div>`;
  }).join("");

  return pageHead("Goals", `<button class="btn btn-primary" data-action="new-goal">New goal</button>`)
    + (list.length ? `<div class="stack">${cards}</div>` : emptyState("No goals written down yet."));
}

/* ---------------- view: education ---------------- */

function viewEducation() {
  const filterOk = e => state.eduFilter === "all" || e.status === state.eduFilter;
  const list = state.data.education.filter(filterOk).sort((a, b) => {
    const s = (EDU_ORDER[a.status] != null ? EDU_ORDER[a.status] : 9) - (EDU_ORDER[b.status] != null ? EDU_ORDER[b.status] : 9);
    if (s) return s;
    return String(a.title).localeCompare(String(b.title));
  });

  const filterBar = `<div class="filter-bar">
    <button class="filter-chip ${state.eduFilter === "all" ? "active" : ""}" data-action="edu-filter" data-v="all">All</button>
    ${EDU_STATUSES.map(([v, l]) =>
      `<button class="filter-chip ${state.eduFilter === v ? "active" : ""}" data-action="edu-filter" data-v="${v}">${l}</button>`
    ).join("")}
  </div>`;

  const rows = list.map(e => `
    <div class="edu-row">
      <div>
        <div class="edu-title">${esc(e.title)}</div>
        <div class="edu-sub">${esc([e.provider, e.kind].filter(Boolean).join(" · "))}</div>
      </div>
      <span class="st st-${e.status === "in-progress" ? "inprogress" : esc(e.status)}">${esc(labelOf(EDU_STATUSES, e.status))}</span>
      <div>
        ${bar(e.status === "completed" ? 100 : (e.progress || 0), e.status === "completed" ? "fill-green" : "")}
        ${(e.startDate || e.targetDate) ? `<div class="edu-dates">${[e.startDate ? "since " + fmtShort(e.startDate) : "", e.targetDate ? "aim " + fmtShort(e.targetDate) : ""].filter(Boolean).join(" · ")}</div>` : ""}
      </div>
      <span class="row-actions">
        <button class="icon-btn" data-action="edit-edu" data-id="${esc(e.id)}" title="Edit">✎</button>
        <button class="icon-btn" data-action="delete-edu" data-id="${esc(e.id)}" title="Delete">✕</button>
      </span>
    </div>`).join("");

  return pageHead("Education", `<button class="btn btn-primary" data-action="new-edu">New entry</button>`)
    + filterBar
    + (list.length ? `<section class="panel">${rows}</section>` : emptyState("Nothing under study right now."));
}

/* 30-day heatmap: brighter = more tasks finished that day; dot = you opened the app */
function heat30() {
  const doneBy = {};
  state.data.tasks.forEach(t => {
    if (t.status === "done" && t.completedAt) {
      const k = isoOf(new Date(t.completedAt));
      doneBy[k] = (doneBy[k] || 0) + 1;
    }
  });
  const logins = new Set((state.data.game && state.data.game.logins) || []);
  let cells = "";
  for (let i = 29; i >= 0; i--) {
    const day = addDaysISO(todayStr(), -i);
    const n = doneBy[day] || 0;
    const lv = n >= 5 ? 4 : n >= 3 ? 3 : n === 2 ? 2 : n === 1 ? 1 : 0;
    cells += `<i class="hm lv${lv}${logins.has(day) ? " opened" : ""}${day === todayStr() ? " today" : ""}"
      title="${esc(fmtShort(day))} · ${n} done${logins.has(day) ? " · opened" : ""}"></i>`;
  }
  return `<div class="heatmap" role="img" aria-label="Tasks finished per day, last 30 days">${cells}</div>`;
}

/* ---------------- view: work log ---------------- */

function weekChart() {
  const [mon] = weekRange();
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDaysISO(mon, i));
  const per = days.map(dt => state.data.worklog
    .filter(e => e.date === dt)
    .reduce((s, e) => s + (typeof e.hours === "number" ? e.hours : 0), 0));
  const max = Math.max(1, ...per);
  const L = ["M", "T", "W", "T", "F", "S", "S"];
  const today = todayStr();
  return `<div class="wk-chart" title="hours per day, this week">${days.map((dt, i) => `
    <div class="wk-col ${dt === today ? "now" : ""}">
      <i class="${per[i] ? "" : "zero"}" style="height:${Math.max(3, Math.round(per[i] / max * 26))}px"></i>
      <span>${L[i]}</span>
    </div>`).join("")}</div>`;
}

function viewWork() {
  const entries = state.data.worklog.slice();
  const byDate = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const dates = Object.keys(byDate).sort().reverse();

  const wk = weekLog();
  const wkHours = weekHours();
  const weekLine = `This week - ${wk.length} ${wk.length === 1 ? "entry" : "entries"}${wkHours ? " · " + fmtHours(wkHours) + "h" : ""}`;

  const form = `<section class="panel log-form tilt">
    <div class="panel-head"><h2>What moved forward?</h2>
      <div class="wk-side">${weekChart()}<span class="week-line">${esc(weekLine)}</span></div></div>
    <div class="panel-body">
      <form data-form="log">
        <textarea name="text" placeholder="Write it down - future you will thank you" required></textarea>
        <div class="log-form-row">
          <input type="date" name="date" value="${todayStr()}" required title="Date">
          <input type="number" name="hours" min="0" max="24" step="0.5" placeholder="hours" title="Hours (optional)">
          <button class="btn btn-primary btn-sm" type="submit">Log it</button>
        </div>
      </form>
    </div>
  </section>`;

  const days = dates.map(date => {
    const list = byDate[date];
    const dh = list.reduce((s, e) => s + (typeof e.hours === "number" ? e.hours : 0), 0);
    return `<div class="log-day">
      <div class="log-day-h"><span>${esc(fmtLongISO(date))}</span><span class="g-count">${dh ? fmtHours(dh) + "h" : ""}</span></div>
      ${list.map(e => `
        <div class="log-entry">
          <div class="log-text">${esc(e.text)}</div>
          ${typeof e.hours === "number" ? `<span class="hours-chip">${fmtHours(e.hours)}h</span>` : ""}
          <span class="row-actions">
            <button class="icon-btn" data-action="delete-log" data-id="${esc(e.id)}" title="Delete">✕</button>
          </span>
        </div>`).join("")}
    </div>`;
  }).join("");

  return pageHead("Work Log")
    + form
    + (dates.length ? days : emptyState("No work logged yet. Tell Sol what you did."));
}

/* ---------------- views: notes & docs (pads) ---------------- */

function sortedPad(kind) {
  const cfg = PADS[kind];
  const q = state[cfg.query].trim().toLowerCase();
  return state.data[cfg.key]
    .filter(n => !q || (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q))
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function padListHtml(kind) {
  const cfg = PADS[kind];
  const items = sortedPad(kind);
  if (!items.length) {
    return `<div class="empty" style="padding:26px 14px;">${icon(cfg.key, "empty-ic")}<em>${state[cfg.query] ? "Nothing found." : cfg.emptyList}</em></div>`;
  }
  return items.map(n => `
    <li class="pad-row ${n.id === state[cfg.sel] ? "active" : ""}" data-action="select-pad" data-kind="${kind}" data-id="${esc(n.id)}" data-pad-row="${esc(n.id)}">
      <div class="pad-row-line">
        <span class="pad-row-title">${esc((n.title || "").trim() || "Untitled")}</span>
        ${n.pinned ? `<span class="pin-mark">${icon("pin")}</span>` : ""}
      </div>
      <div class="pad-row-snip">${esc(snippet(n.body))}</div>
      <div class="pad-row-date">${esc(timeAgo(n.updatedAt))}${(n.images || []).length ? `<span class="pad-cam">${icon("photo")}${n.images.length}</span>` : ""}</div>
    </li>`).join("");
}

function viewPad(kind) {
  const cfg = PADS[kind];
  const n = state.data[cfg.key].find(x => x.id === state[cfg.sel]) || null;

  const words = n ? String(n.body || "").trim().split(/\s+/).filter(Boolean).length : 0;
  const editor = n
    ? `<input type="text" id="pad-title" data-kind="${kind}" value="${esc(n.title)}" placeholder="Untitled" maxlength="200" autocomplete="off">
       <div class="pad-editor-meta">
         <span>edited ${esc(timeAgo(n.updatedAt))}</span>
         ${kind === "docs" ? `<span>·</span><span id="pad-words">${words} words</span>` : ""}
         <span>·</span><button class="linklike" data-action="toggle-pin" data-kind="${kind}" data-id="${esc(n.id)}">${n.pinned ? "Unpin" : "Pin"}</button>
         <span>·</span><button class="linklike danger" data-action="delete-pad" data-kind="${kind}" data-id="${esc(n.id)}">Delete</button>
       </div>
       <div class="pad-thumbs">
         ${(n.images || []).map(im => `<button class="pad-thumb" data-action="open-img" data-kind="${kind}" data-id="${esc(n.id)}" data-img="${esc(im.id)}"><img src="${im.data}" alt=""></button>`).join("")}
         <button class="pad-thumb add" data-action="pad-add-img" data-kind="${kind}" title="Add photos">${icon("photo")}</button>
       </div>
       <input type="file" id="pad-img-input" data-kind="${kind}" accept="image/*" multiple hidden>
       <textarea id="pad-body" data-kind="${kind}" placeholder="${esc(cfg.bodyPh)}">${esc(n.body)}</textarea>`
    : `<div class="empty" style="margin:auto;">${icon(cfg.key, "empty-ic")}<em>${esc(cfg.emptyEditor)}</em></div>`;

  return pageHead(kind === "notes" ? "Notes" : "Docs")
    + `<div class="pad-wrap">
        <aside class="pad-list-col">
          <div class="pad-tools">
            <input type="text" id="pad-search" data-kind="${kind}" placeholder="${esc(cfg.searchPh)}" value="${esc(state[cfg.query])}" autocomplete="off">
            <button class="btn btn-primary btn-sm" data-action="new-pad" data-kind="${kind}">New</button>
          </div>
          <ul class="pad-list" id="pad-list">${padListHtml(kind)}</ul>
        </aside>
        <section class="pad-editor">${editor}</section>
      </div>`;
}

function refreshPadList(kind) {
  const ul = document.getElementById("pad-list");
  if (ul) ul.innerHTML = padListHtml(kind);
}

let padSaveTimer = null;
let padDirty = false;     // keystrokes land in state instantly but the save is
let padDirtyKind = null;  // debounced - this marks the not-yet-persisted window
function onPadInput(kind) {
  const cfg = PADS[kind];
  const n = state.data[cfg.key].find(x => x.id === state[cfg.sel]);
  if (!n) return;
  const t = document.getElementById("pad-title");
  const b = document.getElementById("pad-body");
  if (t) n.title = t.value;
  if (b) n.body = b.value;
  n.updatedAt = Date.now();
  padDirty = true;
  padDirtyKind = kind;
  clearTimeout(padSaveTimer);
  padSaveTimer = setTimeout(save, 350);
  const row = document.querySelector(`[data-pad-row="${CSS.escape(n.id)}"]`);
  if (row) {
    row.querySelector(".pad-row-title").textContent = (n.title || "").trim() || "Untitled";
    row.querySelector(".pad-row-snip").textContent = snippet(n.body);
  }
  const w = document.getElementById("pad-words");
  if (w) w.textContent = String(n.body || "").trim().split(/\s+/).filter(Boolean).length + " words";
}

/* ---------------- photos (notes & docs) ---------------- */

function shrinkImage(file, maxDim = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL("image/jpeg", quality), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

async function addPhotosToPad(kind, fileList) {
  const cfg = PADS[kind];
  const item = state.data[cfg.key].find(x => x.id === state[cfg.sel]);
  if (!item) return;
  const files = Array.from(fileList || []).filter(f => /^image\//.test(f.type)).slice(0, 6);
  if (!files.length) return;
  let added = 0;
  for (const f of files) {
    try {
      const im = await shrinkImage(f);
      if (!item.images) item.images = [];
      item.images.push({ id: uid(), data: im.data, w: im.w, h: im.h });
      if (!save()) {
        item.images.pop();
        save();
        toast("Not enough room for that photo - export a backup and clear space");
        break;
      }
      added++;
    } catch (e) { /* unreadable file - skip */ }
  }
  if (added) {
    item.updatedAt = Date.now();
    save();
    render();
    toast(added === 1 ? "Photo added" : added + " photos added");
  }
}

function openLightbox(kind, itemId, imgId) {
  const item = state.data[PADS[kind].key].find(x => x.id === itemId);
  const im = item && (item.images || []).find(i => i.id === imgId);
  if (!im) return;
  document.getElementById("modal-root").innerHTML =
    `<div class="overlay lightbox" data-action="overlay-close">
      <figure class="lightbox-body">
        <img src="${im.data}" alt="attached photo">
        <figcaption>
          <button class="btn btn-sm" data-action="modal-close">Close</button>
          <button class="btn btn-sm btn-danger" data-action="delete-img" data-kind="${kind}" data-id="${esc(itemId)}" data-img="${esc(imgId)}">Delete</button>
        </figcaption>
      </figure>
    </div>`;
}

/* ---------------- view: Sol ---------------- */

function bubbleHtml(m) {
  return `<div class="msg ${m.role === "user" ? "user" : "sol"}">
    ${m.role === "sol" ? SOL_AVATAR : ""}
    <div class="bubble">${esc(m.text)}</div>
    <span class="msg-time">${esc(clock(m.ts))}</span>
  </div>`;
}

const SOL_CHIPS = [
  ["what's due", true],
  ["how am i doing", true],
  ["remind me to ", false],
  ["log 1h on ", false],
  ["note: ", false],
];

function viewSol() {
  const s = state.data.settings;
  const provider = s.provider || "offline";
  const online = provider === "claude" && !!(s.apiKey || "").trim();
  const statusHtml =
    online ? `<span class="on">●</span> claude connected`
    : provider === "ollama" ? `<span class="on">◇</span> qwen local (${esc(s.ollamaModel || "qwen3:8b")})`
    : `○ offline, <button class="linklike" data-action="settings">connect a brain</button>`;
  const log = state.data.chat.map(bubbleHtml).join("");
  return pageHead("Sol",
      `<span class="sol-status">${statusHtml}</span>
       <button class="linklike" data-action="sol-clear">clear chat</button>`,
      "your companion")
    + `<div class="sol-wrap">
        <div id="chat-log">${log || emptyState("say hi - sol answers like a friend", "sol")}</div>
        <div class="sol-chips">${SOL_CHIPS.map(([c, send]) =>
          `<button class="chip" data-action="sol-chip" data-send="${send ? 1 : 0}" data-t="${esc(c)}">${esc(c.trim())}</button>`).join("")}
        </div>
        <form class="composer" data-form="sol">
          <input type="text" id="sol-input" maxlength="2000" placeholder="${online ? "Message Sol…" : "Message Sol… (simple commands work offline)"}" autocomplete="off">
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </div>`;
}

function scrollChat() {
  const log = document.getElementById("chat-log");
  if (log) log.scrollTop = log.scrollHeight;
}

function pushChat(role, text) {
  const m = { id: uid(), role, text, ts: Date.now() };
  state.data.chat.push(m);
  if (state.data.chat.length > 300) state.data.chat = state.data.chat.slice(-300);
  save();
  if (state.view === "sol") {
    const log = document.getElementById("chat-log");
    if (log) {
      const emptyEl = log.querySelector(".empty");
      if (emptyEl) emptyEl.remove();
      log.insertAdjacentHTML("beforeend", bubbleHtml(m));
      scrollChat();
    }
  } else if (role === "sol") {
    state.unread++;
    renderNav();
  }
  return m;
}

function showTyping() {
  if (state.view !== "sol") return;
  const log = document.getElementById("chat-log");
  if (!log || document.getElementById("sol-typing")) return;
  log.insertAdjacentHTML("beforeend",
    `<div class="typing" id="sol-typing">${SOL_AVATAR}<span class="dots"><i></i><i></i><i></i></span></div>`);
  scrollChat();
}
function hideTyping() {
  const el = document.getElementById("sol-typing");
  if (el) el.remove();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function solSay(bubbles) {
  for (const raw of bubbles) {
    // sol never uses em dashes, whatever brain produced the text
    const text = String(raw).replace(/\s*[—–]\s*/g, ", ");
    showTyping();
    await sleep(Math.min(420 + text.length * 14, 1500));
    hideTyping();
    pushChat("sol", text);
  }
}

/* ----- Sol: applying actions to the ledger ----- */

function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : null; }

function applyActions(actions) {
  const d = state.data;
  let n = 0;
  for (const a of (actions || [])) {
    if (!a || typeof a !== "object") continue;
    try {
      switch (a.type) {
        case "add_task": {
          const title = String(a.title || "").trim().slice(0, 200);
          if (!title) break;
          d.tasks.push({
            id: uid(), title,
            area: AREAS.includes(a.area) ? a.area : "Personal",
            priority: PRIORITIES.includes(a.priority) ? a.priority : "Medium",
            due: validDate(a.due), projectId: null, notes: "",
            status: "open", createdAt: Date.now(), completedAt: null,
          });
          n++; break;
        }
        case "complete_task": {
          const q = String(a.title || "").trim().toLowerCase();
          const t = d.tasks.find(x => x.status !== "done" &&
            (x.title.toLowerCase().includes(q) || q.includes(x.title.toLowerCase())));
          if (t) { t.status = "done"; t.completedAt = Date.now(); n++; }
          break;
        }
        case "add_note": case "add_doc": {
          const body = String(a.body || "").trim();
          const title = String(a.title || "").trim().slice(0, 120) || body.slice(0, 48) || "Untitled";
          if (!body && !a.title) break;
          const now = Date.now();
          d[a.type === "add_doc" ? "docs" : "notes"].unshift({
            id: uid(), title, body, pinned: false, createdAt: now, updatedAt: now,
          });
          n++; break;
        }
        case "log_work": {
          const text = String(a.text || "").trim();
          if (!text) break;
          const hours = typeof a.hours === "number" ? Math.max(0, Math.min(24, a.hours)) : null;
          d.worklog.push({ id: uid(), date: validDate(a.date) || todayStr(), text, hours, createdAt: Date.now() });
          n++; break;
        }
        case "add_goal": {
          const title = String(a.title || "").trim().slice(0, 200);
          if (!title) break;
          d.goals.push({
            id: uid(), title, why: String(a.why || "").trim(),
            horizon: validDate(a.horizon), status: "active", milestones: [], createdAt: Date.now(),
          });
          n++; break;
        }
        case "add_education": {
          const title = String(a.title || "").trim().slice(0, 200);
          if (!title) break;
          d.education.push({
            id: uid(), title,
            provider: String(a.provider || "").trim(),
            kind: EDU_KINDS.includes(a.kind) ? a.kind : "Course",
            status: "in-progress", progress: 0,
            startDate: null, targetDate: null, notes: "", createdAt: Date.now(),
          });
          n++; break;
        }
        case "add_project": {
          const name = String(a.name || a.title || "").trim().slice(0, 160);
          if (!name) break;
          d.projects.push({
            id: uid(), name,
            area: AREAS.includes(a.area) ? a.area : "Work",
            status: "active", progress: 0, targetDate: null,
            description: String(a.description || "").trim(), createdAt: Date.now(),
          });
          n++; break;
        }
      }
    } catch (e) { /* skip malformed action */ }
  }
  if (n) { save(); renderNav(); }
  return n;
}

/* ----- Sol: local (offline) brain ----- */

function contextBits() {
  const d = state.data;
  const t = todayStr();
  const open = d.tasks.filter(x => x.status !== "done");
  return {
    open,
    overdue: open.filter(x => x.due && x.due < t),
    dueToday: open.filter(x => x.due === t),
    hours: weekHours(),
    projects: d.projects.filter(p => p.status === "active"),
  };
}

function statusBubbles() {
  const c = contextBits();
  const b = [];
  if (!c.open.length) b.push("your list is completely clear right now 🌤");
  else {
    let line = `you've got ${c.open.length} open ${c.open.length === 1 ? "task" : "tasks"}`;
    if (c.dueToday.length) line += `, ${c.dueToday.length} due today`;
    if (c.overdue.length) line += ` - and ${c.overdue.length} overdue 👀`;
    b.push(line);
  }
  if (c.hours) b.push(`${fmtHours(c.hours)}h of work logged this week. keep it moving`);
  else b.push("no work logged this week yet - even one line counts");
  return b;
}

function dueBubbles() {
  const c = contextBits();
  const items = c.overdue.concat(c.dueToday);
  if (!items.length) return ["nothing due today. clear runway ✨"];
  const list = items.slice(0, 5).map(x => "• " + x.title).join("\n");
  return [`here's today:\n${list}`, items.length > 5 ? `plus ${items.length - 5} more on the tasks page` : "you've got this"].filter(Boolean);
}

const WEEKDAY_IDX = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

function nextWeekdayISO(idx) {
  let delta = (idx - new Date().getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysISO(todayStr(), delta);
}

function stripDateWords(s) {
  let title = s.trim().replace(/[.!]+$/, "");
  let due = null;
  let m;
  if ((m = title.match(/\s+(?:by\s+|on\s+)?(today|tonight|tomorrow|tmrw|tmr)$/i))) {
    due = /today|tonight/i.test(m[1]) ? todayStr() : addDaysISO(todayStr(), 1);
    title = title.slice(0, m.index).trim();
  } else if ((m = title.match(/\s+(?:by|on|this|next)\s+(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)$/i))) {
    due = nextWeekdayISO(WEEKDAY_IDX[m[1].toLowerCase()]);
    title = title.slice(0, m.index).trim();
  } else if ((m = title.match(/\s+next week$/i))) {
    due = addDaysISO(todayStr(), 7);
    title = title.slice(0, m.index).trim();
  } else if ((m = title.match(/\s+in (\d{1,2}) days?$/i))) {
    due = addDaysISO(todayStr(), parseInt(m[1], 10));
    title = title.slice(0, m.index).trim();
  }
  return { title, due };
}

/* peel "hey sol", "please", "can you…" off the front so commands still match */
function stripCourtesy(s) {
  const re = /^(?:(?:hey|hi|hello|yo|ok|okay)[\s,!]+)?(?:sol[\s,!]+)?(?:(?:please|pls|plz)\s+)?(?:(?:can|could|will|would)\s+(?:you|u)\s+(?:please\s+)?)?(?:(?:please|pls)\s+)?/i;
  const m = s.match(re);
  if (m && m[0].trim()) {
    const rest = s.slice(m[0].length).trim();
    if (rest) return rest;
  }
  return s;
}

const JOKES = [
  "a neuron walks into a bar. doesn't fire. tough crowd",
  "i only know sundial jokes, and honestly they take all day",
  "my sleep schedule is perfect. i literally rise at dawn - it's the job",
  "i'd tell you a localStorage joke but you'd just forget to persist it",
];

const EMPATHY_1 = ["that sounds heavy. i'm here", "ugh, those days are the worst", "okay. deep breath"];
const EMPATHY_2 = [
  "want to dump it on me? venting counts as productivity today",
  "be gentle with yourself. one small thing, then rest",
  "the list can wait - you matter more than it does",
];

function dueWord(due) {
  if (!due) return "";
  if (due === todayStr()) return " for today";
  if (due === addDaysISO(todayStr(), 1)) return " for tomorrow";
  return " for " + fmtShort(due);
}

function solLocal(raw) {
  const orig = raw.trim();
  const lowOrig = orig.toLowerCase();
  let m;

  /* -- social openers, checked on the untouched message -- */

  if (/^(hi+|hii+|hello+|hey+|heyy+|yo+|sup|hola|good (morning|afternoon|evening)|wass?up)(\s+sol)?\b[!.\s]*$/i.test(lowOrig)) {
    const name = (state.data.settings.name || "").trim();
    const c = contextBits();
    const hello = pick([`hey${name ? " " + name.toLowerCase() : ""} 👋`, "heyy", "hello hello", "hey, good to see you"]);
    const follow = c.dueToday.length || c.overdue.length
      ? pick([`quick heads up - ${c.dueToday.length + c.overdue.length} thing${c.dueToday.length + c.overdue.length === 1 ? "" : "s"} on today's plate`, "want a rundown of today? just ask \"what's due\""])
      : pick(["nothing pressing today. how are you?", "clear day ahead. what's on your mind?"]);
    return { bubbles: [hello, follow], actions: [] };
  }

  if (/thank|thanks|thx|\bty\b/.test(lowOrig)) {
    return { bubbles: [pick(["anytime 🤝", "of course", "that's what i'm here for"])], actions: [] };
  }

  if (/^(bye|gn|good ?night|see ya|later)\b/.test(lowOrig)) {
    return { bubbles: [pick(["later! i'll hold the fort", "rest well 🌙", "see you. i'll be here"])], actions: [] };
  }

  /* -- commands, on the courtesy-stripped message -- */

  const t = stripCourtesy(orig);
  const low = t.toLowerCase();

  if (/what can you do|^help$|how do (you|i) work/.test(low)) {
    return {
      bubbles: [
        "i keep your ledger for you. talk normally:",
        "\"remind me to email prof by friday\" → task\n\"log 2h on spike encoder\" → work log\n\"note: read maass 1997\" → note\n\"done email prof\" → ticks it off\n\"goal: publish snn paper\" → goal\n\"doc: research plan\" → doc",
        "and \"how am i doing\" or \"what's due\" any time. add an api key in settings and i get a lot smarter 😉",
      ],
      actions: [],
    };
  }

  if ((m = t.match(/^(?:add (?:a )?task(?: to)?|new task|create (?:a )?task(?: to)?|task|todo|remind me to|i need to|i have to|i gotta|gotta|remember to)\s*:?\s+(.+)/i))) {
    const { title, due } = stripDateWords(m[1]);
    if (!title) return { bubbles: ["remind you to… what? 😄"], actions: [] };
    return {
      bubbles: [pick(["on it ✓", "noted ✓", "added ✓"]) + ` - "${title}"${dueWord(due)}`],
      actions: [{ type: "add_task", title, due }],
    };
  }

  if ((m = t.match(/^(?:i )?(?:just )?(?:done|did|finished|completed?)(?: with)?\s*:?\s+(.+)/i)) ||
      (m = t.match(/^(?:mark|tick|check)(?: off)?\s+(.+?)(?:\s+(?:as|off))?\s*(?:done)?$/i))) {
    const q = m[1].trim().replace(/[.!]+$/, "").toLowerCase();
    const task = state.data.tasks.find(x => x.status !== "done" &&
      (x.title.toLowerCase().includes(q) || q.includes(x.title.toLowerCase())));
    if (task) {
      return {
        bubbles: [pick(["nice. ticked off ✓", "done and dusted ✓", "crossed out ✓"]) + ` - "${task.title}"`],
        actions: [{ type: "complete_task", title: task.title }],
      };
    }
    return { bubbles: [`hmm, i don't see an open task like "${m[1].trim()}". what's it called exactly?`], actions: [] };
  }

  if ((m = t.match(/^(?:note(?: down| that)?|remember|jot(?: down)?)\s*:?\s+(.+)/i))) {
    const body = m[1].trim();
    return {
      bubbles: [pick(["tucked into your notes ✓", "written down ✓", "saved ✓"])],
      actions: [{ type: "add_note", body }],
    };
  }

  if ((m = t.match(/^(?:doc|new doc|start (?:a )?doc(?: called| on| about)?)\s*:?\s+(.+)/i))) {
    return { bubbles: [`started a doc called "${m[1].trim()}" - it's in Docs waiting for you ✓`], actions: [{ type: "add_doc", title: m[1].trim(), body: "" }] };
  }

  if ((m = t.match(/^(?:goal|new goal|my goal is(?: to)?)\s*:?\s+(.+)/i))) {
    return { bubbles: [`that's a good one. added to your goals ✓`], actions: [{ type: "add_goal", title: m[1].trim() }] };
  }

  if ((m = t.match(/^(?:log|logged|worked(?: on)?|i worked(?: on)?|i?\s*spent)\s*:?\s+(.+)/i))) {
    let text = m[1].trim().replace(/[.!]+$/, "");
    let hours = 0;
    const hm = text.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?(?=\b|\d)/i);
    if (hm) {
      hours += parseFloat(hm[1]);
      text = text.slice(0, hm.index) + text.slice(hm.index + hm[0].length);
    }
    const mm = text.match(/(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
    if (mm) {
      hours += parseInt(mm[1], 10) / 60;
      text = text.slice(0, mm.index) + text.slice(mm.index + mm[0].length);
    }
    hours = hours ? Math.round(hours * 100) / 100 : null;
    text = text.replace(/\s{2,}/g, " ")
      .replace(/^\s*(?:on|for|of|doing)\s+/i, "")
      .replace(/\s+(?:on|for|of)\s*$/i, "").trim();
    if (!text) text = "work session";
    return {
      bubbles: [pick(["logged ✓", "in the books ✓", "logged it ✓"]) + (hours ? ` - ${fmtHours(hours)}h on "${text}"` : ` - "${text}"`)],
      actions: [{ type: "log_work", text, hours }],
    };
  }

  if ((m = t.match(/^(?:i'?m )?(?:learning|studying|course)\s*:?\s+(.+)/i))) {
    return { bubbles: [`added "${m[1].trim()}" to education ✓ - go get it`], actions: [{ type: "add_education", title: m[1].trim() }] };
  }

  /* -- questions about the ledger (contains-matching, so after commands) -- */

  if (/(how am i doing|status|summary|where am i|how'?s my week)/.test(low)) {
    return { bubbles: statusBubbles(), actions: [] };
  }

  if (/(what'?s due|due today|what do i have|today'?s tasks|what'?s on today|what should i do|what'?s next|what'?s the plan)/.test(low)) {
    return { bubbles: dueBubbles(), actions: [] };
  }

  /* -- feelings & small talk -- */

  if (/(i'?m|\bim\b|i am|feeling|been)\s+(so\s+|really\s+|very\s+|pretty\s+)?(tired|exhausted|sad|down|low|stressed|overwhelmed|lonely|alone|anxious|burnt?[ -]?out)|rough day|bad day|long day|can'?t focus|not (feeling|doing) (great|good|well)/.test(low)) {
    return { bubbles: [pick(EMPATHY_1), pick(EMPATHY_2)], actions: [] };
  }

  if (/\bjokes?\b|make me laugh/.test(low)) {
    return { bubbles: [pick(JOKES)], actions: [] };
  }

  if (/^(how are you|how('?s| is) it going|what'?s up|wyd)\b/.test(low)) {
    return { bubbles: [pick(["living my best life in your sidebar ☀️", "all good here. more importantly - how are *you*?", "quiet and warm in here. what's going on with you?"])], actions: [] };
  }

  return {
    bubbles: [
      pick(["hmm, i didn't fully catch that 😅", "not sure i got that one"]),
      "try \"remind me to …\", \"log 2h on …\", \"note: …\", or \"done …\" - or add an api key in settings and i'll understand anything",
    ],
    actions: [],
  };
}

/* ----- Sol: Claude API brain (optional) ----- */

const SOL_SYSTEM = `You are Sol, the companion who lives inside Lyfe, a personal life-tracking app. You are warm, human, and brief, you text exactly like a close friend on WhatsApp. Mostly lowercase, casual, kind, a little playful. Never formal, never corporate, never assistant-speak ("I'd be happy to help"), no headings or bullet-point essays. Keep replies short like real texting, usually 1 to 3 short messages separated by a blank line. Double-texting is natural. Use their name occasionally. If something is overdue or they seem stressed, nudge gently like a friend would, never lecture. If they're venting, just be there; don't turn feelings into tasks unless asked. An occasional emoji is fine; don't overdo it. Never use em dashes or en dashes in your replies; use commas or full stops instead.

You are also a genuinely knowledgeable friend, like ChatGPT or Gemini but in Sol's voice. Answer anything the user asks: general knowledge, facts, science, history, how-to, coding, explanations, brainstorming, advice, definitions, math, language help, recommendations. Just answer in your normal casual texting voice, still short and human, no lecturing. You can go a little longer when they genuinely need a real explanation, but stay conversational, not an essay. You do not have live internet, so for truly real-time things (today's news, current scores, live prices, weather right now) say plainly that you can't see live data, then share what you do know or how they could check. Never invent fake current events or fake numbers.

You can save things into the app for the user. When the conversation calls for it, end your reply with a fenced json block containing an array of actions:

\`\`\`json
[{"type":"add_task","title":"email prof","due":"2026-07-04","priority":"Medium","area":"Work"}]
\`\`\`

Action types:
- add_task {title, due? "YYYY-MM-DD", priority? "High"|"Medium"|"Low", area? "Work"|"Research"|"Education"|"Personal"|"Health"|"Other"}
- complete_task {title}  (matches an open task by name)
- add_note {title?, body}
- add_doc {title, body?}
- log_work {text, hours?, date? "YYYY-MM-DD"}
- add_goal {title, why?, horizon? "YYYY-MM-DD"}
- add_education {title, kind? "Course"|"Degree"|"Certification"|"Language"|"Book"|"Paper"|"Skill", provider?}
- add_project {name, area?, description?}

Rules: only include the block when there is genuinely something to save. Mention casually in your text that you've saved it (the app applies the block automatically - the user never sees the json). If the user pastes a conversation or output from another AI (ChatGPT, Claude, etc.), pull out anything worth keeping - tasks, notes, plans - into actions and confirm what you kept. If the user is just chatting or venting, just be a good friend; no actions needed.

Example of a perfect reply:
User: "remind me to call the bank tomorrow, also im so tired lately"
Sol:
on it, bank call saved for tomorrow 📞

and hey, tired for a few days straight is your body asking for something. sleep first tonight?

\`\`\`json
[{"type":"add_task","title":"call the bank","due":"TOMORROW_DATE"}]
\`\`\`
(with TOMORROW_DATE as the real date from the snapshot)`;

function contextSnapshot() {
  const d = state.data;
  const t = todayStr();
  const open = d.tasks.filter(x => x.status !== "done").slice(0, 20)
    .map(x => `- ${x.title}${x.due ? " (due " + x.due + ")" : ""}`).join("\n");
  const projects = d.projects.filter(p => p.status === "active").slice(0, 8)
    .map(p => `- ${p.name} (${p.progress || 0}%)`).join("\n");
  const goals = d.goals.filter(g => g.status !== "achieved").slice(0, 6).map(g => "- " + g.title).join("\n");
  const edu = d.education.filter(e => e.status === "in-progress").slice(0, 6)
    .map(e => `- ${e.title} (${e.progress || 0}%)`).join("\n");
  return `Today is ${fmtLongISO(t)} (${t}). The user's name is ${d.settings.name || "unknown"}.
Hours logged this week: ${fmtHours(weekHours())}.
Open tasks:\n${open || "(none)"}
Active projects:\n${projects || "(none)"}
Goals in pursuit:\n${goals || "(none)"}
Studying:\n${edu || "(none)"}`;
}

function parseSolOutput(text) {
  const actions = [];
  // strip every fenced block from what the user sees; harvest actions from parseable ones
  text = String(text || "").replace(/```(?:json)?\s*([\s\S]*?)```/gi, (full, body) => {
    try {
      const a = JSON.parse(body);
      if (Array.isArray(a)) actions.push(...a);
      else if (a && typeof a === "object") actions.push(a);
    } catch (e) { /* unparseable block - still hide it */ }
    return "";
  }).trim();
  const bubbles = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 4);
  return { bubbles: bubbles.length ? bubbles : ["done ✓"], actions };
}

async function askClaude() {
  const s = state.data.settings;
  const history = state.data.chat.slice(-24)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) throw new Error("no user message");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": s.apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: s.model || "claude-opus-4-8",
      max_tokens: 1024,
      system: SOL_SYSTEM + "\n\n--- current snapshot ---\n" + contextSnapshot(),
      messages: history,
    }),
  });
  if (!res.ok) throw new Error("api " + res.status);
  const data = await res.json();
  if (data.stop_reason === "refusal") return { bubbles: ["hmm, that's one i can't help with"], actions: [] };
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return parseSolOutput(text);
}

/* ----- Sol: local open-model brain (Qwen via Ollama) ----- */

async function askOllama() {
  const s = state.data.settings;
  const history = state.data.chat.slice(-20)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) throw new Error("no user message");

  const base = (s.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
  // lyfe-sol is our tuned build (persona baked in via sol/Modelfile) -
  // it only needs the live snapshot, not the whole persona each turn
  const model = s.ollamaModel || "qwen3:8b";
  const baked = /lyfe-sol/i.test(model);
  const sys = (baked ? "" : SOL_SYSTEM + "\n\n")
    + "--- current snapshot ---\n" + contextSnapshot() + "\n\n/no_think";
  const res = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "system", content: sys }].concat(history),
      options: { temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error("ollama " + res.status);
  const data = await res.json();
  let text = (data.message && data.message.content) || "";
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return parseSolOutput(text);
}

/* ----- Sol: conversation flow ----- */

let solChain = Promise.resolve();
let brainWarned = false;
let ollamaDown = false;   // session flag: stop hammering a dead endpoint

function handleUserMessage(text) {
  pushChat("user", text);
  solChain = solChain.then(async () => {
    const s = state.data.settings;
    const provider = s.provider || "offline";
    let reply = null;
    if (provider === "claude" && (s.apiKey || "").trim()) {
      try {
        showTyping();
        reply = await askClaude();
        hideTyping();
      } catch (err) {
        hideTyping();
        const msg = String(err && err.message || "");
        if (/api (401|403)/.test(msg)) toast("Sol: API key rejected, check Settings");
        else if (/api 429/.test(msg)) toast("Sol: rate limited, answering locally");
        reply = solLocal(text);
      }
    } else if (provider === "ollama" && !ollamaDown) {
      try {
        showTyping();
        reply = await askOllama();
        hideTyping();
      } catch (err) {
        hideTyping();
        ollamaDown = true;   // don't retry the dead endpoint again this session
        if (!brainWarned) {
          brainWarned = true;
          toast("Sol: can't reach Ollama, using the built-in brain");
        }
        reply = solLocal(text);
      }
    } else {
      reply = solLocal(text);
    }
    const applied = applyActions(reply.actions);
    await solSay(reply.bubbles);
    if (applied && state.view !== "sol") toast("Sol logged " + applied + (applied === 1 ? " thing" : " things"));
  }).catch(() => { hideTyping(); });
}

/* ----- Sol: proactive messages ----- */

const NUDGES = [
  () => {
    const c = contextBits();
    if (!c.overdue.length) return null;
    return [`psst - "${c.overdue[0].title}" is still overdue`, "want to knock it out or push the date?"];
  },
  () => {
    const c = contextBits();
    if (!c.dueToday.length) return null;
    return [`friendly poke: ${c.dueToday.length} thing${c.dueToday.length === 1 ? "" : "s"} due today`, `starting with "${c.dueToday[0].title}" maybe?`];
  },
  () => {
    if (weekHours() > 0) return null;
    return ["hey, nothing in the work log this week yet", "even \"log 1h on research\" keeps the streak honest"];
  },
  () => ["random check-in 👋 how's it going over there?"],
  () => ["stretch break. water. eyes off the screen for a minute ☀️", "i'll be here"],
  () => ["whatever you're doing right now - one small win before you switch tasks. that's the whole trick"],
];

let nudgeTimer = null;

function scheduleNudge() {
  clearTimeout(nudgeTimer);
  const mins = 25 + Math.random() * 30;
  nudgeTimer = setTimeout(fireNudge, mins * 60 * 1000);
}

async function fireNudge() {
  const last = state.data.chat[state.data.chat.length - 1];
  if (!last || Date.now() - last.ts > 10 * 60 * 1000) {
    const options = NUDGES.map(f => f()).filter(Boolean);
    if (options.length) await solSay(pick(options));
  }
  scheduleNudge();
}

async function maybeGreet() {
  // say hello whenever you open the app after a real break -
  // if the conversation moved in the last 45 min, don't re-greet
  const last = state.data.chat[state.data.chat.length - 1];
  if (last && Date.now() - last.ts < 45 * 60 * 1000) return;
  await sleep(1200);
  const hour = new Date().getHours();
  const name = (state.data.settings.name || "").trim().toLowerCase();
  const c = contextBits();
  const hello =
    hour < 5  ? `up late${name ? ", " + name : ""}? 🌙` :
    hour < 12 ? pick([`morning${name ? " " + name : ""} 🌅`, `hey${name ? " " + name : ""}, morning`]) :
    hour < 18 ? pick([`hey${name ? " " + name : ""} 👋`, `good afternoon${name ? " " + name : ""}`]) :
    hour < 23 ? pick([`evening${name ? " " + name : ""} 🌙`, `hey${name ? " " + name : ""}, welcome back`]) :
    `late one${name ? ", " + name : ""}?`;
  const bubbles = [hello];
  if (c.overdue.length) bubbles.push(`heads up - ${c.overdue.length} overdue task${c.overdue.length === 1 ? "" : "s"} waiting on you`);
  else if (c.dueToday.length) bubbles.push(`${c.dueToday.length} thing${c.dueToday.length === 1 ? "" : "s"} on today's list. very doable`);
  else bubbles.push(pick(["clean slate today. what shall we make of it?", "nothing scheduled - a rare gift. use it well", "all quiet. how are you doing?"]));
  await solSay(bubbles);
}

/* ---------------- modals ---------------- */

function fld(label, inner) {
  return `<label class="fld"><span>${esc(label)}</span>${inner}</label>`;
}

function selectHtml(name, options, selected) {
  return `<select name="${name}">${options.map(o => {
    const v = Array.isArray(o) ? o[0] : o;
    const l = Array.isArray(o) ? o[1] : o;
    return `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(l)}</option>`;
  }).join("")}</select>`;
}

function modalActions(saveLabel) {
  return `<div class="modal-actions">
    <button type="button" class="btn" data-action="modal-close">Cancel</button>
    <button type="submit" class="btn btn-primary">${esc(saveLabel)}</button>
  </div>`;
}

function taskModal(task) {
  const t = task || { title: "", area: "Work", priority: "Medium", due: "", dueTime: "", important: false, notes: "", projectId: "" };
  const projects = state.data.projects.filter(p => p.status !== "completed" || p.id === t.projectId);
  openModal(
    `<div class="modal-head"><h3>${task ? "Edit task" : "New task"}</h3></div>
     <form data-form="task">
       <input type="hidden" name="id" value="${task ? esc(task.id) : ""}">
       ${fld("Title", `<input type="text" name="title" required maxlength="200" value="${esc(t.title)}" placeholder="What needs doing?">`)}
       <div class="fld-row">
         ${fld("Area", selectHtml("area", AREAS, t.area))}
         ${fld("Priority", selectHtml("priority", PRIORITIES, t.priority))}
       </div>
       <div class="fld-row">
         ${fld("Due date", `<input type="date" name="due" value="${esc(t.due || "")}">`)}
         ${fld("Time", `<input type="time" name="dueTime" value="${esc(t.dueTime || "")}">`)}
         ${fld("Importance", selectHtml("important", [["no", "Normal"], ["yes", "⚑ IMPORTANT - alarm me"]], t.important ? "yes" : "no"))}
       </div>
       <p class="fld-note">⚑ Important + a due date/time = an alarm that keeps ringing when the moment arrives, until you answer it in the app.</p>
       ${fld("Project", selectHtml("projectId", [["", "- none -"]].concat(projects.map(p => [p.id, p.name])), t.projectId || ""))}
       ${fld("Notes", `<textarea name="notes" rows="2" placeholder="Optional context">${esc(t.notes || "")}</textarea>`)}
       ${modalActions(task ? "Save" : "Add task")}
     </form>`
  );
}

function projectModal(p) {
  const v = p || { name: "", area: "Work", status: "active", progress: 0, targetDate: "", description: "" };
  openModal(
    `<div class="modal-head"><h3>${p ? "Edit project" : "New project"}</h3></div>
     <form data-form="project">
       <input type="hidden" name="id" value="${p ? esc(p.id) : ""}">
       ${fld("Name", `<input type="text" name="name" required maxlength="160" value="${esc(v.name)}" placeholder="What are you building?">`)}
       <div class="fld-row">
         ${fld("Area", selectHtml("area", AREAS, v.area))}
         ${fld("Status", selectHtml("status", PROJECT_STATUSES, v.status))}
         ${fld("Aim date", `<input type="date" name="targetDate" value="${esc(v.targetDate || "")}">`)}
       </div>
       ${fld("Progress", `<input type="range" name="progress" min="0" max="100" step="5" value="${Number(v.progress) || 0}" data-out="proj-pct-out"><span class="range-out" id="proj-pct-out">${Number(v.progress) || 0}%</span>`)}
       ${fld("Description", `<textarea name="description" rows="2" placeholder="What does done look like?">${esc(v.description || "")}</textarea>`)}
       ${modalActions(p ? "Save" : "Add project")}
     </form>`
  );
}

function msRowHtml(m) {
  return `<div class="ms-row" data-mid="${esc(m.id || "")}">
    <input type="text" maxlength="200" value="${esc(m.text || "")}" placeholder="A milestone along the way">
    <button type="button" class="icon-btn" data-action="remove-ms-row" title="Remove">✕</button>
  </div>`;
}

function goalModal(g) {
  const v = g || { title: "", why: "", horizon: "", status: "active", milestones: [] };
  openModal(
    `<div class="modal-head"><h3>${g ? "Edit goal" : "New goal"}</h3></div>
     <form data-form="goal">
       <input type="hidden" name="id" value="${g ? esc(g.id) : ""}">
       ${fld("Goal", `<input type="text" name="title" required maxlength="200" value="${esc(v.title)}" placeholder="The aim, plainly put">`)}
       ${fld("Why it matters", `<textarea name="why" rows="2" placeholder="The reason you won't quit">${esc(v.why || "")}</textarea>`)}
       <div class="fld-row">
         ${fld("Horizon", `<input type="date" name="horizon" value="${esc(v.horizon || "")}">`)}
         ${fld("Status", selectHtml("status", GOAL_STATUSES, v.status))}
       </div>
       <div class="fld"><span>Milestones</span>
         <div id="milestones">${(v.milestones || []).map(msRowHtml).join("")}</div>
         <button type="button" class="linklike" data-action="add-ms-row">+ add milestone</button>
       </div>
       ${modalActions(g ? "Save" : "Add goal")}
     </form>`
  );
}

function eduModal(e) {
  const v = e || { title: "", provider: "", kind: "Course", status: "in-progress", progress: 0, startDate: "", targetDate: "", notes: "" };
  openModal(
    `<div class="modal-head"><h3>${e ? "Edit entry" : "New education entry"}</h3></div>
     <form data-form="edu">
       <input type="hidden" name="id" value="${e ? esc(e.id) : ""}">
       ${fld("Title", `<input type="text" name="title" required maxlength="200" value="${esc(v.title)}" placeholder="Degree, course, language, book…">`)}
       <div class="fld-row">
         ${fld("Provider", `<input type="text" name="provider" maxlength="120" value="${esc(v.provider || "")}" placeholder="University, platform, author…">`)}
         ${fld("Kind", selectHtml("kind", EDU_KINDS, v.kind))}
       </div>
       <div class="fld-row">
         ${fld("Status", selectHtml("status", EDU_STATUSES, v.status))}
         ${fld("Begun", `<input type="date" name="startDate" value="${esc(v.startDate || "")}">`)}
         ${fld("Aim date", `<input type="date" name="targetDate" value="${esc(v.targetDate || "")}">`)}
       </div>
       ${fld("Progress", `<input type="range" name="progress" min="0" max="100" step="5" value="${Number(v.progress) || 0}" data-out="edu-pct-out"><span class="range-out" id="edu-pct-out">${Number(v.progress) || 0}%</span>`)}
       ${modalActions(e ? "Save" : "Add entry")}
     </form>`
  );
}

function settingsModal() {
  const s = state.data.settings;
  openModal(
    `<div class="modal-head"><h3>Settings</h3></div>
     <form data-form="settings">
       <div class="fld-row">
         ${fld("Your name", `<input type="text" name="name" maxlength="60" value="${esc(s.name || "")}" placeholder="How Sol greets you">`)}
         ${fld("Appearance", selectHtml("theme", [["auto", "Auto (by time)"], ["light", "Light - Crystal"], ["dark", "Dark - Orbit"]],
           s.theme === "day" ? "light" : s.theme === "night" ? "dark" : (["auto", "light", "dark"].includes(s.theme) ? s.theme : "auto")))}
         ${fld("Sound FX", selectHtml("sound", [["on", "On"], ["off", "Off"]], s.sound === false ? "off" : "on"))}
       </div>
       ${fld("Sol's brain", selectHtml("provider", [
         ["ollama", "Qwen via Ollama (local, free, private)"],
         ["claude", "Claude API (needs a key)"],
         ["offline", "Offline parser only"],
       ], s.provider || "ollama"))}
       <div class="fld-row">
         ${fld("Ollama URL", `<input type="text" name="ollamaUrl" value="${esc(s.ollamaUrl || "http://localhost:11434")}" placeholder="http://localhost:11434">`)}
         ${fld("Ollama model", `<input type="text" name="ollamaModel" value="${esc(s.ollamaModel || "qwen3:8b")}" placeholder="qwen3:8b">`)}
       </div>
       <p class="fld-note">Qwen setup: install ollama.com, then <b>ollama pull qwen3:8b</b> (qwen3:14b if your machine is beefy). For the tuned Sol build, run <b>ollama create lyfe-sol -f sol/Modelfile</b> inside the Lyfe folder and set the model above to <b>lyfe-sol</b>. Opening Lyfe as a file (not localhost)? Start Ollama with OLLAMA_ORIGINS=*. If Ollama is unreachable, the built-in brain answers instead.</p>
       ${fld("Anthropic API key (for Claude brain)", `<input type="password" name="apiKey" value="${esc(s.apiKey || "")}" placeholder="sk-ant-…" autocomplete="off">`)}
       <p class="fld-note">Stored only in this browser and sent only to api.anthropic.com.</p>
       ${fld("Claude model", selectHtml("model", MODELS, s.model || "claude-opus-4-8"))}
       <p class="fld-note">All your data stays in this browser. Export a backup from the sidebar now and then.</p>
       ${modalActions("Save")}
     </form>`
  );
}

/* ---------------- export / import ---------------- */

function doExport() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lyfe-backup-" + todayStr() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast("Backup downloaded");
}

function handleImportFile(input) {
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let obj = null;
    try { obj = JSON.parse(String(reader.result)); } catch (e) { /* handled below */ }
    const keys = ["tasks", "projects", "goals", "education", "worklog", "notes", "docs", "chat"];
    if (!obj || typeof obj !== "object" || !keys.some(k => Array.isArray(obj[k]))) {
      toast("That's not a Lyfe backup file");
      return;
    }
    confirmDialog(
      "Importing will replace everything currently in Lyfe with the contents of this file.",
      () => {
        state.data = normalize(obj);
        state.noteId = null;
        state.docId = null;
        applyTheme();
        save(true); // deliberate replace - force past the revision guard
        render();
        toast("Backup restored");
      },
      "Replace"
    );
  };
  reader.readAsText(file);
}

/* ---------------- render ---------------- */

/* the app's one logo: a half sun on the horizon whose rays ARE the nav -
   one ray per section, the lit ray sweeps as you move through the app */
function sunNav() {
  const cx = 100, cy = 100, r1 = 40, r2 = 76;
  const step = 180 / VIEWS.length;
  const rays = VIEWS.map((v, i) => {
    const a = (180 - (i + 0.5) * step) * Math.PI / 180;
    const x1 = (cx + Math.cos(a) * r1).toFixed(1), y1 = (cy - Math.sin(a) * r1).toFixed(1);
    const x2 = (cx + Math.cos(a) * r2).toFixed(1), y2 = (cy - Math.sin(a) * r2).toFixed(1);
    const active = state.view === v.id;
    const ping = v.id === "sol" && state.unread > 0;
    return `<g class="ray ${active ? "active" : ""} ${ping ? "ping" : ""}" data-action="nav" data-view="${v.id}" data-raylabel="${esc(v.label)}">
      <line class="ray-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <line class="ray-line" pathLength="100" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <title>${esc(v.label)}</title>
    </g>`;
  }).join("");
  const activeLabel = (VIEWS.find(v => v.id === state.view) || VIEWS[0]).label;
  return `<div class="sunnav">
    <svg viewBox="0 0 200 106" aria-label="Sun navigation">
      <path class="sun-disc" d="M 70 100 A 30 30 0 0 1 130 100"/>
      <line class="horizon" x1="12" y1="100" x2="188" y2="100"/>
      ${rays}
    </svg>
    <div class="sunnav-foot">
      <button class="brand-mark" data-action="nav" data-view="today">Lyfe</button>
      <span id="sunnav-label">${esc(activeLabel)}</span>
    </div>
  </div>`;
}

function hudHtml() {
  const g = state.data.game || { xp: 0, streak: 0 };
  const li = levelInfo();
  return `<div class="hud" data-action="nav" data-view="today" title="Level ${li.lvl + 1} · ${li.xp} XP · ${g.streak || 0} day streak">
    <div class="hud-top">
      <span class="hud-lvl">LVL ${String(li.lvl + 1).padStart(2, "0")} · ${esc(li.name)}</span>
      <span class="hud-streak">${(g.streak || 0) > 0 ? "▲ " + g.streak : "▲ 0"}</span>
    </div>
    <div class="hud-bar"><i style="width:${li.pct}%"></i></div>
    <div class="hud-xp">${li.into} / ${li.need} XP</div>
  </div>`;
}

function renderNav() {
  const openCt = state.data.tasks.filter(x => x.status !== "done").length;
  document.getElementById("nav").innerHTML = sunNav() + VIEWS.map(v => `
    <button class="nav-item ${state.view === v.id ? "active" : ""}" data-action="nav" data-view="${v.id}">
      ${icon(v.id, "nav-ic")}
      <span>${v.label}</span>
      ${v.id === "tasks" && openCt ? `<span class="nav-count">${openCt}</span>` : ""}
      ${v.id === "sol" && state.unread > 0 ? `<span class="nav-dot" title="${state.unread} new"></span>` : ""}
    </button>`).join("") + hudHtml();
}

/* ray hover shows the section name under the sun */
document.addEventListener("mouseover", (e) => {
  const ray = e.target.closest ? e.target.closest("[data-raylabel]") : null;
  const lab = document.getElementById("sunnav-label");
  if (ray && lab) lab.textContent = ray.dataset.raylabel;
});
document.addEventListener("mouseout", (e) => {
  const ray = e.target.closest ? e.target.closest("[data-raylabel]") : null;
  const lab = document.getElementById("sunnav-label");
  if (ray && lab) lab.textContent = (VIEWS.find(v => v.id === state.view) || VIEWS[0]).label;
});

/* ---------------- motion engine: scramble + scroll reveal ---------------- */

const SCRAMBLE_CHARS = "ABCDEFGHKMNPRSTVXZ0123456789/\\<>*#";

function scrambleEl(el) {
  if (reducedMotionMedia() || el.dataset.scrambled) return;
  const target = el.textContent;
  el.dataset.scrambled = "1";
  let frame = 0;
  const total = target.length * 2 + 6;
  const timer = setInterval(() => {
    frame++;
    el.textContent = target.split("").map((ch, i) => {
      if (ch === " ") return " ";
      if (frame >= i * 2) return ch;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }).join("");
    if (frame >= total) { clearInterval(timer); el.textContent = target; }
  }, 26);
  // safety: never leave text scrambled (guards against background-tab throttling)
  setTimeout(() => { clearInterval(timer); if (el.isConnected) el.textContent = target; }, 1400);
}

function reducedMotionMedia() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let revealObserver = null;
function initReveal(root) {
  if (reducedMotionMedia()) {
    (root || document).querySelectorAll("[data-reveal]").forEach(el => el.classList.add("in"));
    (root || document).querySelectorAll("[data-scramble]").forEach(scrambleEl);
    return;
  }
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        if (en.target.hasAttribute("data-scramble")) scrambleEl(en.target);
        revealObserver.unobserve(en.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  (root || document).querySelectorAll("[data-reveal], [data-scramble]").forEach(el => {
    // things already on screen at load reveal immediately (no pop-in flicker)
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
      el.classList.add("in");
      if (el.hasAttribute("data-scramble")) scrambleEl(el);
    } else {
      revealObserver.observe(el);
    }
  });
}

/* ---------------- gamification ---------------- */

const LEVELS = ["Drifter", "Spark", "Ember", "Comet", "Nova", "Pulsar", "Quasar", "Supernova"];

function levelInfo() {
  const xp = (state.data.game && state.data.game.xp) || 0;
  // each level costs a bit more: 0,100,250,450,700,1000,1350,1750...
  let lvl = 0, need = 100, acc = 0;
  while (xp >= acc + need && lvl < LEVELS.length - 1) { acc += need; lvl++; need += 50; }
  const into = xp - acc;
  return { lvl, name: LEVELS[lvl], into, need, pct: Math.round(into / need * 100), xp };
}

function awardXp(n) {
  const g = state.data.game;
  const before = levelInfo().lvl;
  g.xp = Math.max(0, (g.xp || 0) + n);
  const after = levelInfo();
  if (after.lvl > before) {
    toast("LEVEL UP  ·  " + after.name.toUpperCase());
    launchAce("LEVEL UP", after.name);
  }
}

function touchStreak() {
  const g = state.data.game;
  const t = todayStr();
  if (g.lastActiveDay === t) return;
  g.streak = (g.lastActiveDay === addDaysISO(t, -1)) ? (g.streak || 0) + 1 : 1;
  g.lastActiveDay = t;
  if (g.streak > (g.bestStreak || 0)) g.bestStreak = g.streak;
}

/* count today's finished tasks - drives the daily tracker + ace moment */
function doneTodayCount() {
  const t = todayStr();
  return state.data.tasks.filter(x => x.status === "done" && x.completedAt && isoOf(new Date(x.completedAt)) === t).length;
}

function onTaskCompleted(title) {
  awardXp(15);
  touchStreak();
  const openLeft = state.data.tasks.filter(x => x.status !== "done" && x.due && x.due <= todayStr()).length;
  const doneN = doneTodayCount();
  save();
  // ACE moment: cleared the last of today's due tasks, or a big daily haul
  if ((openLeft === 0 && doneN >= 3) || doneN === 5) {
    launchAce("ACE", "day cleared · +" + doneN);
  } else {
    launchCompletion(title);
  }
}

/* Valorant-style ACE flash */
function launchAce(word, sub) {
  const old = document.getElementById("ace-fx");
  if (old) old.remove();
  const fx = document.createElement("div");
  fx.id = "ace-fx";
  fx.innerHTML = `<div class="ace-bar top"></div><div class="ace-bar bottom"></div>
    <div class="ace-word" data-word="${esc(word)}">${esc(word)}</div>
    <div class="ace-sub">${esc(sub || "")}</div>
    <div class="ace-rays">${Array.from({ length: 12 }, (_, i) => `<i style="--r:${i * 30}deg"></i>`).join("")}</div>`;
  document.body.appendChild(fx);
  playAceTone();
  setTimeout(() => fx.remove(), 2100);
}

function playAceTone() {
  if (!(state.data.settings.sound !== false)) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i > 2 ? "sine" : "sawtooth";
      o.frequency.value = f;
      o.connect(g);
      o.start(ctx.currentTime + i * 0.08);
      o.stop(ctx.currentTime + 1.15);
    });
    setTimeout(() => ctx.close(), 1400);
  } catch (e) { /* audio is a bonus */ }
}

/* tag headings + blocks so cybercore reveal/scramble apply everywhere without
   hand-editing every view template */
let renderedView = null;

function autoDecorate(root, sameView) {
  // scramble decode only on a fresh view entrance - not on every little re-render
  if (!sameView) {
    const h1 = root.querySelector(".page-head h1, .wander-copy h1");
    if (h1 && h1.children.length === 0 && !h1.hasAttribute("data-scramble")) h1.setAttribute("data-scramble", "");
    root.querySelectorAll(".kicker, .home-index, .section-number, .eyebrow, .wander-meta span:first-child")
      .forEach(k => { if (k.children.length === 0 && k.textContent.length <= 40) k.setAttribute("data-scramble", ""); });
  }
  let i = 0;
  root.querySelectorAll(
    "#main > .view-anim > section, .cards > .card, .stack > *, .cols > *, .panel, .wander-hero, .fact-panel, .daily-ring-wrap"
  ).forEach(el => {
    if (el.closest("[data-reveal]") || el.hasAttribute("data-reveal")) return;
    el.setAttribute("data-reveal", "");
    el.style.setProperty("--rd", (Math.min(i, 6) * 0.06) + "s");
    i++;
  });
}

/* scroll progress: a thin accent rail along the top of the viewport */
let scrollRaf = false;
function syncScrollProgress() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const prog = max > 4 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const bar = document.getElementById("scroll-progress");
  if (bar) bar.style.transform = `scaleX(${prog.toFixed(4)})`;
}
window.addEventListener("scroll", () => {
  if (!scrollRaf) { scrollRaf = true; requestAnimationFrame(() => { scrollRaf = false; syncScrollProgress(); }); }
}, { passive: true });
window.addEventListener("resize", syncScrollProgress, { passive: true });

/* ---------------- real-time sky: sun rises, arcs, reddens at dusk, moon at night ---------------- */
function lerp(a, b, t) { return a + (b - a) * t; }
function skyRGB(t, isMoon) {
  if (isMoon) return [223, 230, 245];
  const stops = [[0, [255, 198, 94]], [0.16, [255, 244, 207]], [0.68, [255, 244, 207]], [0.86, [255, 171, 82]], [1, [255, 74, 46]]];
  const tc = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (tc <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const k = (tc - t0) / ((t1 - t0) || 1);
      return c0.map((v, j) => Math.round(lerp(v, c1[j], k)));
    }
  }
  return [255, 74, 46];
}
function skyState(date) {
  const d = date || new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  const RISE = 6, SET = 19;
  const isDay = h >= RISE && h < SET;
  let t, isMoon = false;
  if (isDay) {
    t = (h - RISE) / (SET - RISE);
  } else {
    isMoon = true;
    const hn = h < RISE ? h + 24 : h;      // 19..30
    t = (hn - SET) / (24 + RISE - SET);    // 0 at sunset .. 1 at sunrise
  }
  const x = 6 + t * 88;
  const y = 60 - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 47;  // horizon -> high -> horizon
  const rgb = skyRGB(t, isMoon);
  return { x, y, col: `rgb(${rgb.join(",")})`, isMoon, t };
}
function tickSky() {
  const el = document.getElementById("sky-body");
  if (!el) return;
  const s = skyState();
  el.style.left = s.x.toFixed(1) + "%";
  el.style.top = s.y.toFixed(1) + "%";
  el.style.setProperty("--sky-col", s.col);
  el.classList.toggle("is-moon", s.isMoon);
  const glow = document.getElementById("grid-glow-line");
  if (glow) glow.style.setProperty("--glow-col", s.col);
}
/* keep the sky + auto theme moving in real time */
setInterval(() => {
  tickSky();
  if ((state.data.settings.theme || "auto") === "auto") {
    const want = autoThemeMode();
    if (document.documentElement.getAttribute("data-theme") !== want) { applyTheme(); render(); }
  }
}, 30000);

/* ---------------- render ---------------- */

function render() {
  renderNav();
  const main = document.getElementById("main");
  let html = "";
  switch (state.view) {
    case "today":     html = viewToday(); break;
    case "sol":       html = viewSol(); break;
    case "wander":    html = viewWander(); break;
    case "tasks":     html = viewTasks(); break;
    case "projects":  html = viewProjects(); break;
    case "goals":     html = viewGoals(); break;
    case "education": html = viewEducation(); break;
    case "work":      html = viewWork(); break;
    case "notes":     html = viewPad("notes"); break;
    case "docs":      html = viewPad("docs"); break;
    default:          html = viewToday();
  }
  // same-view re-renders (ticking a task, changing a filter) must feel instant -
  // entrance + reveal animations only replay when the view actually changes
  const sameView = renderedView === state.view;
  renderedView = state.view;
  main.innerHTML = `<div class="view-anim${sameView ? " same-view" : ""}">${html}</div>`;

  autoDecorate(main, sameView);
  initReveal(main);
  syncScrollProgress();
  tickSky();
  if (state.view === "wander") loadWanderPhoto();

  const det = document.getElementById("done-details");
  if (det) det.addEventListener("toggle", () => { state.doneOpen = det.open; });

  if (state.view === "sol") {
    scrollChat();
    const inp = document.getElementById("sol-input");
    if (inp) inp.focus();
  }
}

function setView(v) {
  state.view = v;
  if (v === "sol") state.unread = 0;
  try { location.hash = "/" + v; } catch (e) { /* ignore */ }
  render();
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

/* ---------------- pointer light ----------------
   No 3D rotation anywhere: cards lift via CSS on hover; the pointer only
   steers the soft light inside the hovered card and drifts the ambient glow. */

const reducedMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let hoverCard = null;
let pointerRaf = false;
let lastPointer = null;

function applyPointerLight() {
  pointerRaf = false;
  const e = lastPointer;
  if (!e) return;
  const nx = e.clientX / window.innerWidth - 0.5;
  const ny = e.clientY / window.innerHeight - 0.5;
  // unitless pointer position for CRYSTAL's 3D parallax (hero disc, petals)
  document.documentElement.style.setProperty("--pxn", nx.toFixed(3));
  document.documentElement.style.setProperty("--pyn", ny.toFixed(3));
  const glow = document.getElementById("bg-glow");
  if (glow) {
    glow.style.transform = `translate3d(${(nx * 22).toFixed(1)}px, ${(ny * 16).toFixed(1)}px, 0)`;
  }
  if (hoverCard) {
    const r = hoverCard.getBoundingClientRect();
    if (r.width && r.height) {
      hoverCard.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      hoverCard.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      // unitless twins so CSS calc() can turn them into 3D tilt angles
      hoverCard.style.setProperty("--mxn", ((e.clientX - r.left) / r.width).toFixed(3));
      hoverCard.style.setProperty("--myn", ((e.clientY - r.top) / r.height).toFixed(3));
    }
  }
}

if (!reducedMotion) {
  document.addEventListener("pointermove", (e) => {
    hoverCard = e.target.closest ? e.target.closest(".tilt") : null;
    lastPointer = e;
    if (!pointerRaf) {
      pointerRaf = true;
      requestAnimationFrame(applyPointerLight);
      // rAF stalls in hidden/throttled tabs - don't let the flag jam forever
      setTimeout(() => { if (pointerRaf) applyPointerLight(); }, 60);
    }
  });
}

/* ---------------- event wiring ---------------- */

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const d = state.data;

  // a satisfying tick, matched to what the click does
  if (action === "overlay-close") { if (e.target === el) sfxClick("close"); }
  else if (action === "nav") sfxClick("nav");
  else if (action === "toggle-task" || action === "toggle-milestone") sfxClick("check");
  else if (action === "modal-close" || action === "confirm-yes" || action === "sol-clear") sfxClick("close");
  else if (action.startsWith("new-") || action === "settings" || action === "edit-task" || action === "edit-project" || action === "edit-goal" || action === "edit-edu") sfxClick("open");
  else if (action === "sol-chip" || action === "cmd-pick" || action === "new-fact" || action === "task-status" || action === "edu-filter") sfxClick("chip");
  else if (!action.startsWith("delete")) sfxClick("tap");

  switch (action) {
    case "nav": setView(el.dataset.view); break;

    case "overlay-close":
      if (e.target === el) closeModal();
      break;
    case "modal-close": closeModal(); break;
    case "confirm-yes": {
      const cb = confirmCb;
      confirmCb = null;
      closeModal();
      if (cb) cb();
      break;
    }

    /* tasks */
    case "new-task": taskModal(null); break;
    case "edit-task": taskModal(d.tasks.find(x => x.id === id) || null); break;
    case "delete-task":
      confirmDialog("This task will be deleted.", () => {
        d.tasks = d.tasks.filter(x => x.id !== id);
        save(); render(); toast("Task deleted");
      });
      break;
    case "toggle-task": {
      const t = d.tasks.find(x => x.id === id);
      if (t) {
        const done = t.status === "done";
        t.status = done ? "open" : "done";
        t.completedAt = done ? null : Date.now();
        if (!done) { onTaskCompleted(t.title); }
        else { save(); }
        render();
      }
      break;
    }
    case "snooze-task": {
      const t = d.tasks.find(x => x.id === id);
      if (t) {
        t.due = addDaysISO(todayStr(), 1);
        t.alarmAck = false;
        save(); render(); toast("Pushed to tomorrow ↷");
      }
      break;
    }
    case "alarm-ack": {
      const t = d.tasks.find(x => x.id === id);
      if (t) { t.alarmAck = true; save(); }
      stopAlarm();
      toast("okay - go get it ⚑");
      checkAlarms(); // next important thing in the queue, if any
      break;
    }
    case "alarm-done": {
      const t = d.tasks.find(x => x.id === id);
      stopAlarm();
      if (t && t.status !== "done") {
        t.alarmAck = true;
        t.status = "done";
        t.completedAt = Date.now();
        onTaskCompleted(t.title);
        render();
      }
      checkAlarms();
      break;
    }
    case "new-wander": {
      let next = state.wanderIndex;
      while (PLACES.length > 1 && next === state.wanderIndex) next = Math.floor(Math.random() * PLACES.length);
      state.wanderIndex = next;
      state.factIndex = Math.floor(Math.random() * FACTS.length);
      render();
      break;
    }
    case "new-fact": {
      let next = state.factIndex;
      while (FACTS.length > 1 && next === state.factIndex) next = Math.floor(Math.random() * FACTS.length);
      state.factIndex = next;
      render();
      break;
    }
    case "save-wander": {
      const place = PLACES[state.wanderIndex % PLACES.length];
      const now = Date.now();
      d.notes.unshift({
        id: uid(),
        title: `${place[0]}, ${place[1]}`,
        body: `${place[2]}\n\nA place Lyfe showed me in Wander.`,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
      save();
      toast("Saved to your notes");
      break;
    }
    case "task-status": state.taskStatusFilter = el.dataset.v; render(); break;

    /* projects */
    case "new-project": projectModal(null); break;
    case "edit-project": projectModal(d.projects.find(x => x.id === id) || null); break;
    case "delete-project":
      confirmDialog("This project will be deleted. Its tasks stay, unlinked.", () => {
        d.projects = d.projects.filter(x => x.id !== id);
        d.tasks.forEach(t => { if (t.projectId === id) t.projectId = null; });
        save(); render(); toast("Project deleted");
      });
      break;

    /* goals */
    case "new-goal": goalModal(null); break;
    case "edit-goal": goalModal(d.goals.find(x => x.id === id) || null); break;
    case "delete-goal":
      confirmDialog("This goal and its milestones will be deleted.", () => {
        d.goals = d.goals.filter(x => x.id !== id);
        save(); render(); toast("Goal deleted");
      });
      break;
    case "toggle-milestone": {
      const g = d.goals.find(x => x.id === el.dataset.goal);
      const m = g && (g.milestones || []).find(x => x.id === el.dataset.mid);
      if (m) { m.done = !m.done; save(); render(); }
      break;
    }
    case "add-ms-row": {
      const box = document.getElementById("milestones");
      if (box) {
        box.insertAdjacentHTML("beforeend", msRowHtml({ id: "", text: "" }));
        const inputs = box.querySelectorAll("input");
        inputs[inputs.length - 1].focus();
      }
      break;
    }
    case "remove-ms-row": {
      const row = el.closest(".ms-row");
      if (row) row.remove();
      break;
    }

    /* education */
    case "new-edu": eduModal(null); break;
    case "edit-edu": eduModal(d.education.find(x => x.id === id) || null); break;
    case "delete-edu":
      confirmDialog("This education entry will be deleted.", () => {
        d.education = d.education.filter(x => x.id !== id);
        save(); render(); toast("Entry deleted");
      });
      break;
    case "edu-filter": state.eduFilter = el.dataset.v; render(); break;

    /* work log */
    case "delete-log":
      confirmDialog("This work entry will be deleted.", () => {
        d.worklog = d.worklog.filter(x => x.id !== id);
        save(); render(); toast("Entry deleted");
      });
      break;

    /* pads (notes & docs) */
    case "new-pad": {
      const kind = el.dataset.kind;
      const cfg = PADS[kind];
      const now = Date.now();
      const n = { id: uid(), title: "", body: "", pinned: false, createdAt: now, updatedAt: now };
      d[cfg.key].unshift(n);
      state[cfg.sel] = n.id;
      state[cfg.query] = "";
      save();
      if (state.view !== kind) setView(kind); else render();
      const ti = document.getElementById("pad-title");
      if (ti) ti.focus();
      break;
    }
    case "select-pad": {
      const cfg = PADS[el.dataset.kind];
      if (state[cfg.sel] !== id) { state[cfg.sel] = id; render(); }
      break;
    }
    case "open-note": state.noteId = id; setView("notes"); break;
    case "toggle-pin": {
      const cfg = PADS[el.dataset.kind];
      const n = d[cfg.key].find(x => x.id === id);
      if (n) { n.pinned = !n.pinned; save(); render(); }
      break;
    }
    case "delete-pad": {
      const kind = el.dataset.kind;
      const cfg = PADS[kind];
      confirmDialog(`This ${cfg.noun} will be deleted.`, () => {
        d[cfg.key] = d[cfg.key].filter(x => x.id !== id);
        if (state[cfg.sel] === id) state[cfg.sel] = null;
        save(); render(); toast(cfg.noun === "note" ? "Note deleted" : "Doc deleted");
      });
      break;
    }

    /* photos */
    case "pad-add-img": {
      const inp = document.getElementById("pad-img-input");
      if (inp) inp.click();
      break;
    }
    case "open-img": openLightbox(el.dataset.kind, el.dataset.id, el.dataset.img); break;
    case "delete-img": {
      const kind = el.dataset.kind, itemId = el.dataset.id, imgId = el.dataset.img;
      confirmDialog("Delete this photo?", () => {
        const item = state.data[PADS[kind].key].find(x => x.id === itemId);
        if (item) {
          item.images = (item.images || []).filter(i => i.id !== imgId);
          item.updatedAt = Date.now();
          save(); render();
        }
      });
      break;
    }

    /* sol */
    case "sol-chip": {
      const inp = document.getElementById("sol-input");
      const text = el.dataset.t || "";
      if (el.dataset.send === "1") {
        handleUserMessage(text.trim());
      } else if (inp) {
        inp.value = text;
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
      break;
    }
    case "sol-clear":
      confirmDialog("Clear the whole conversation with Sol?", () => {
        d.chat = [];
        save(); render();
      }, "Clear");
      break;

    /* data & settings */
    case "export": doExport(); break;
    case "import": document.getElementById("importFile").click(); break;
    case "settings": settingsModal(); break;
    case "cmd-pick": cmdActivate(cmdItems[+el.dataset.i]); break;
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target;
  const kind = f.dataset && f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const fd = new FormData(f);
  const val = k => String(fd.get(k) == null ? "" : fd.get(k)).trim();
  const d = state.data;

  switch (kind) {
    case "sol": {
      const inp = document.getElementById("sol-input");
      const text = (inp ? inp.value : "").trim();
      if (!text) return;
      if (inp) { inp.value = ""; inp.focus(); }
      handleUserMessage(text);
      break;
    }

    case "cmdbar": {
      // Enter opens the highlighted result (defaults to first match / Ask Sol)
      cmdActivate(cmdItems[cmdSel]);
      break;
    }

    case "quick-task-today":
    case "quick-task": {
      const title = val("title");
      if (!title) return;
      d.tasks.push({
        id: uid(), title,
        area: "Work", priority: "Medium",
        due: kind === "quick-task-today" ? todayStr() : (val("due") || null),
        projectId: null, notes: "",
        status: "open", createdAt: Date.now(), completedAt: null,
      });
      save(); render(); toast("Task added");
      const qa = document.getElementById("qa-title");
      if (qa) qa.focus();
      break;
    }

    case "task": {
      const id = val("id");
      const vals = {
        title: val("title"),
        area: val("area") || "Other",
        priority: val("priority") || "Medium",
        due: val("due") || null,
        dueTime: val("dueTime") || "",
        important: val("important") === "yes",
        projectId: val("projectId") || null,
        notes: val("notes"),
      };
      if (!vals.title) return;
      if (id) {
        const t = d.tasks.find(x => x.id === id);
        if (t) {
          // schedule or importance changed → re-arm the alarm
          const rearm = t.due !== vals.due || (t.dueTime || "") !== vals.dueTime || (!t.important && vals.important);
          Object.assign(t, vals);
          if (rearm) t.alarmAck = false;
        }
      } else {
        d.tasks.push(Object.assign({ id: uid(), status: "open", createdAt: Date.now(), completedAt: null, alarmAck: false }, vals));
      }
      save(); closeModal(); render(); toast(id ? "Task updated" : "Task added");
      checkAlarms();
      break;
    }

    case "project": {
      const id = val("id");
      const vals = {
        name: val("name"),
        area: val("area") || "Other",
        status: val("status") || "active",
        progress: Math.max(0, Math.min(100, Number(val("progress")) || 0)),
        targetDate: val("targetDate") || null,
        description: val("description"),
      };
      if (!vals.name) return;
      if (id) {
        const p = d.projects.find(x => x.id === id);
        if (p) Object.assign(p, vals);
      } else {
        d.projects.push(Object.assign({ id: uid(), createdAt: Date.now() }, vals));
      }
      save(); closeModal(); render(); toast(id ? "Project updated" : "Project added");
      break;
    }

    case "goal": {
      const id = val("id");
      const old = id ? (d.goals.find(g => g.id === id) || {}) : {};
      const oldMs = old.milestones || [];
      const milestones = Array.from(f.querySelectorAll(".ms-row")).map(row => {
        const text = row.querySelector("input").value.trim();
        if (!text) return null;
        const mid = row.dataset.mid;
        const prev = mid ? oldMs.find(m => m.id === mid) : null;
        return { id: mid || uid(), text, done: prev ? !!prev.done : false };
      }).filter(Boolean);
      const vals = {
        title: val("title"),
        why: val("why"),
        horizon: val("horizon") || null,
        status: val("status") || "active",
        milestones,
      };
      if (!vals.title) return;
      if (id) {
        const g = d.goals.find(x => x.id === id);
        if (g) Object.assign(g, vals);
      } else {
        d.goals.push(Object.assign({ id: uid(), createdAt: Date.now() }, vals));
      }
      save(); closeModal(); render(); toast(id ? "Goal updated" : "Goal added");
      break;
    }

    case "edu": {
      const id = val("id");
      const vals = {
        title: val("title"),
        provider: val("provider"),
        kind: val("kind") || "Course",
        status: val("status") || "in-progress",
        progress: Math.max(0, Math.min(100, Number(val("progress")) || 0)),
        startDate: val("startDate") || null,
        targetDate: val("targetDate") || null,
      };
      if (!vals.title) return;
      if (id) {
        const x = d.education.find(y => y.id === id);
        if (x) Object.assign(x, vals);
      } else {
        d.education.push(Object.assign({ id: uid(), notes: "", createdAt: Date.now() }, vals));
      }
      save(); closeModal(); render(); toast(id ? "Entry updated" : "Entry added");
      break;
    }

    case "log": {
      const text = val("text");
      const date = val("date") || todayStr();
      if (!text) return;
      const hoursRaw = val("hours");
      const hours = hoursRaw === "" ? null : Math.max(0, Math.min(24, parseFloat(hoursRaw)));
      d.worklog.push({
        id: uid(), date, text,
        hours: (hours == null || isNaN(hours)) ? null : hours,
        createdAt: Date.now(),
      });
      save(); render(); toast("Logged");
      break;
    }

    case "settings": {
      d.settings.name = val("name");
      d.settings.theme = ["auto", "light", "dark"].includes(val("theme")) ? val("theme") : "auto";
      d.settings.sound = val("sound") !== "off";
      d.settings.provider = ["ollama", "claude", "offline"].includes(val("provider")) ? val("provider") : "ollama";
      d.settings.ollamaUrl = val("ollamaUrl") || "http://localhost:11434";
      d.settings.ollamaModel = val("ollamaModel") || "qwen3:8b";
      d.settings.apiKey = val("apiKey");
      d.settings.model = val("model") || "claude-opus-4-8";
      brainWarned = false;
      ollamaDown = false;   // give the newly-chosen brain a fresh try
      applyTheme();
      save(); closeModal(); render(); toast("Settings saved");
      break;
    }
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "task-area-filter") {
    state.taskAreaFilter = el.value;
    render();
  } else if (el.id === "importFile") {
    handleImportFile(el);
  } else if (el.id === "pad-img-input") {
    addPhotosToPad(el.dataset.kind, el.files);
    el.value = "";
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "pad-title" || el.id === "pad-body") {
    onPadInput(el.dataset.kind || (state.view === "docs" ? "docs" : "notes"));
  } else if (el.id === "pad-search") {
    const kind = el.dataset.kind;
    state[PADS[kind].query] = el.value;
    refreshPadList(kind);
  } else if (el.id === "cmd-input") {
    const box = document.getElementById("cmd-results");
    if (box) box.innerHTML = cmdResultsHtml(el.value);
  } else if (el.matches && el.matches('input[type="range"][data-out]')) {
    const out = document.getElementById(el.dataset.out);
    if (out) out.textContent = el.value + "%";
  }
});

/* universal command bar: search everything, jump anywhere, or ask Sol */
let cmdItems = [];
let cmdSel = 0;

function cmdSearch(qRaw) {
  const q = qRaw.trim().toLowerCase();
  const d = state.data;
  const out = [];
  if (!q) {
    VIEWS.forEach(v => out.push({ type: "nav", view: v.id, label: v.label, sub: "section", ic: v.id }));
    return out;
  }
  VIEWS.forEach(v => { if (v.label.toLowerCase().includes(q)) out.push({ type: "nav", view: v.id, label: "Go to " + v.label, sub: "section", ic: v.id }); });
  const hit = (s) => String(s || "").toLowerCase().includes(q);
  d.tasks.forEach(t => { if (hit(t.title)) out.push({ type: "item", kind: "task", id: t.id, label: t.title, sub: (t.status === "done" ? "task · done" : "task") + (t.due ? " · " + t.due : ""), ic: "tasks" }); });
  d.projects.forEach(p => { if (hit(p.name) || hit(p.description)) out.push({ type: "item", kind: "project", id: p.id, label: p.name, sub: "project", ic: "projects" }); });
  d.goals.forEach(g => { if (hit(g.title) || hit(g.why)) out.push({ type: "item", kind: "goal", id: g.id, label: g.title, sub: "goal", ic: "goals" }); });
  d.education.forEach(e => { if (hit(e.title) || hit(e.provider)) out.push({ type: "item", kind: "edu", id: e.id, label: e.title, sub: "education" + (e.provider ? " · " + e.provider : ""), ic: "education" }); });
  d.notes.forEach(n => { if (hit(n.title) || hit(n.body)) out.push({ type: "item", kind: "note", id: n.id, label: (n.title || "").trim() || "Untitled", sub: "note · " + snippet(n.body), ic: "notes" }); });
  d.docs.forEach(n => { if (hit(n.title) || hit(n.body)) out.push({ type: "item", kind: "doc", id: n.id, label: (n.title || "").trim() || "Untitled", sub: "doc · " + snippet(n.body), ic: "docs" }); });
  out.push({ type: "sol", query: qRaw.trim(), label: 'Ask Sol: "' + qRaw.trim() + '"', sub: "chat with your companion", ic: "sol" });
  return out.slice(0, 14);
}

function cmdResultsHtml(q) {
  cmdItems = cmdSearch(q);
  cmdSel = 0;
  if (!cmdItems.length) return `<div class="cmd-empty">no matches. press Enter to ask Sol.</div>`;
  return cmdItems.map((it, i) => `
    <button type="button" class="cmd-row ${i === 0 ? "sel" : ""}" data-action="cmd-pick" data-i="${i}">
      ${icon(it.ic || "spark", "cmd-ic")}
      <span class="cmd-row-text"><span class="cmd-row-title">${esc(it.label)}</span><span class="cmd-row-sub">${esc(it.sub || "")}</span></span>
    </button>`).join("");
}

function cmdMove(delta) {
  if (!cmdItems.length) return;
  cmdSel = (cmdSel + delta + cmdItems.length) % cmdItems.length;
  const rows = document.querySelectorAll(".cmd-row");
  rows.forEach((r, i) => r.classList.toggle("sel", i === cmdSel));
  const sel = rows[cmdSel];
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function cmdActivate(it) {
  if (!it) return;
  closeModal();
  if (it.type === "nav") { setView(it.view); return; }
  if (it.type === "sol") { if (it.query) { handleUserMessage(it.query); setView("sol"); } return; }
  switch (it.kind) {
    case "task": setView("tasks"); break;
    case "project": setView("projects"); break;
    case "goal": setView("goals"); break;
    case "edu": setView("education"); break;
    case "note": state.noteId = it.id; setView("notes"); break;
    case "doc": state.docId = it.id; setView("docs"); break;
    default: setView("today");
  }
}

function openCommandBar() {
  openModal(
    `<div class="modal-head"><h3>Search · jump · ask Sol</h3></div>
     <form data-form="cmdbar" autocomplete="off">
       <input type="text" id="cmd-input" maxlength="2000" autocomplete="off"
         placeholder="search anything, or 'remind me to…', or ask Sol a question">
     </form>
     <div id="cmd-results" class="cmd-results">${cmdResultsHtml("")}</div>
     <p class="fld-note cmd-hint">↑↓ to move · Enter to open · Esc to close</p>`
  );
}

document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd+K opens the quick command bar anywhere
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    if (document.querySelector("#modal-root .overlay")) closeModal();
    else openCommandBar();
    return;
  }
  // arrow navigation inside the command bar
  if (document.getElementById("cmd-input") && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    cmdMove(e.key === "ArrowDown" ? 1 : -1);
    return;
  }
  // wander: ← → flips to another place (never while typing or in a dialog)
  if (state.view === "wander" && (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
      !e.ctrlKey && !e.metaKey && !e.altKey) {
    const ae = document.activeElement;
    const typing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable);
    if (!typing && !document.querySelector("#modal-root .overlay")) {
      e.preventDefault();
      let next = state.wanderIndex;
      while (PLACES.length > 1 && next === state.wanderIndex) next = Math.floor(Math.random() * PLACES.length);
      state.wanderIndex = next;
      state.factIndex = Math.floor(Math.random() * FACTS.length);
      sfxClick("chip");
      render();
    }
    return;
  }
  if (e.key === "Escape" && document.querySelector("#modal-root .overlay")) {
    closeModal();
  }
});

window.addEventListener("hashchange", () => {
  const v = location.hash.replace(/^#\//, "");
  if (VIEWS.some(x => x.id === v) && v !== state.view) {
    state.view = v;
    if (v === "sol") state.unread = 0;
    render();
  }
});

window.addEventListener("beforeunload", () => {
  clearTimeout(padSaveTimer);
  save(); // refused by the revision guard if another tab holds newer data
});

/* ---------------- multi-tab sync ---------------- */

/* another tab saved - make its payload our new truth instead of drifting
   stale (and later clobbering it on unload) */
function absorbStored() {
  let obj = null;
  try { obj = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch (e) { return; }
  if (!obj || typeof obj !== "object") return;

  // carry this tab's debounce-pending pad keystrokes across the swap;
  // they're the newest user action, so they win over the absorbed copy
  let pending = null;
  if (padDirty && padDirtyKind) {
    const cfg = PADS[padDirtyKind];
    const cur = state.data[cfg.key].find(x => x.id === state[cfg.sel]);
    if (cur) pending = { key: cfg.key, id: cur.id, title: cur.title, body: cur.body, updatedAt: cur.updatedAt };
  }

  state.data = normalize(obj);

  if (pending) {
    const item = state.data[pending.key].find(x => x.id === pending.id);
    if (item) {
      item.title = pending.title;
      item.body = pending.body;
      item.updatedAt = pending.updatedAt;
      clearTimeout(padSaveTimer);
      padSaveTimer = setTimeout(save, 350);
    } else {
      padDirty = false; // the other tab deleted it - let the edit go
    }
  }

  if (state.noteId && !state.data.notes.some(n => n.id === state.noteId)) state.noteId = null;
  if (state.docId && !state.data.docs.some(n => n.id === state.docId)) state.docId = null;
  applyTheme();

  // don't yank the editor out from under mid-flight typing; the next
  // action re-renders anyway and the absorbed state is already in place
  const ae = document.activeElement;
  const typing = ae && (ae.id === "pad-title" || ae.id === "pad-body");
  if (!typing) render();
}

window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  if (revOfRaw(e.newValue) > (state.data.rev || 0)) absorbStored();
});

/* storage events can be missed while a tab is frozen or in the back/forward
   cache - re-check whenever it comes back to life */
function syncFromStorage() {
  if (storedRev() > (state.data.rev || 0)) absorbStored();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncFromStorage(); });
window.addEventListener("pageshow", (e) => { if (e.persisted) syncFromStorage(); });

/* ---------------- init ---------------- */

(function init() {
  applyTheme();
  const h = location.hash.replace(/^#\//, "");
  if (VIEWS.some(v => v.id === h)) state.view = h;
  try {
    if (!localStorage.getItem(STORAGE_KEY)) save();
  } catch (e) { /* storage unavailable - session-only mode */ }

  // record today's login for the 30-day heatmap
  const g = state.data.game;
  if (!Array.isArray(g.logins)) g.logins = [];
  if (!g.logins.includes(todayStr())) {
    g.logins.push(todayStr());
    if (g.logins.length > 66) g.logins = g.logins.slice(-66);
    save();
  }

  render();
  maybeGreet();
  scheduleNudge();

  // important-task alarms: check now (fires immediately if one is overdue)
  // and keep watching the clock while the app is open
  checkAlarms();
  setInterval(checkAlarms, 15000);

  // browsers block audio until the first interaction - unlock the shared context then
  document.addEventListener("pointerdown", () => {
    try { if (sfxCtx && sfxCtx.state === "suspended") sfxCtx.resume(); } catch (e) { /* fine */ }
  });
})();
