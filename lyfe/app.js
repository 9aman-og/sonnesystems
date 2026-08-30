/* ============================================================
   Lyfe - your life, lightly kept
   Vanilla JavaScript. No dependencies. Data in localStorage.
   Aero, the personal intelligence layer, works offline with deterministic tools
   and can route permitted context to a local Ollama model.
   ============================================================ */
"use strict";

/* ---------------- constants ---------------- */

const STORAGE_KEY = "lyfe.v1";

/* Which localStorage key holds the live data. Guests use STORAGE_KEY (as always);
   signed-in users get a per-account cache key so accounts and guest never collide
   on a shared browser. Set by enterGuest()/enterCloud() during boot. */
let ACTIVE_KEY = STORAGE_KEY;
let CLOUD_MODE = false;

function readKey(k) {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}

const VIEWS = [
  { id: "today",     label: "Today" },
  { id: "sol",       label: "Aero" },
  { id: "tracking",  label: "Tracking" },
  { id: "library",   label: "Library" },
  { id: "profile",   label: "Profile" },
];

const TRACKING_VIEWS = ["tasks", "projects", "goals", "work"];
const LIBRARY_VIEWS = ["notes", "docs", "saved", "aero-work"];
const PROFILE_VIEWS = ["profile", "education"];
const ROUTE_VIEWS = ["today", "aero", "sol", "tracking", "library", "profile", "wander"]
  .concat(TRACKING_VIEWS, LIBRARY_VIEWS, PROFILE_VIEWS);

function topSectionOf(view) {
  if (TRACKING_VIEWS.includes(view) || view === "tracking") return "tracking";
  if (LIBRARY_VIEWS.includes(view) || view === "library") return "library";
  if (PROFILE_VIEWS.includes(view)) return "profile";
  return view === "wander" ? "today" : view;
}

function resolvedViewId(view) {
  if (view === "aero") return "sol";
  if (view === "tracking") return state.trackingView || "tasks";
  if (view === "library") return state.libraryView || "notes";
  if (view === "profile") return state.profileView || "profile";
  if (view === "wander") return "today";
  return view;
}

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

function aeroBrandMark(px, cls) {
  return `<span class="aero-brand-mark ${cls || ""}" style="--aero-mark-size:${px}px" aria-hidden="true"><img src="../assets/aero_logo.svg" alt=""></span>`;
}

const SOL_AVATAR = `<span class="aero-avatar" aria-hidden="true"><img src="../assets/aero_logo.svg" alt=""></span>`;

/* small stroke icons - inline svg, themed via currentColor.
   Two visual languages: ORBIT (dark, sharp editorial) and CRYSTAL
   (light, rounded y2k bubbles) - the light mode is its own app. */
const ICONS_ORBIT = {
  today: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8.7 15l2.2 2.2 4.4-4.6"/>',
  sol: '<path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.2-3.4-.7L4 21l1.3-4.4A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  tracking: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="11" cy="19" r="2" fill="currentColor" stroke="none"/>',
  library: '<path d="M5 4.5h5.5v15H5zM13.5 4.5H19v15h-5.5z"/><path d="M10.5 7.5h3M10.5 16.5h3"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4.2 3.1-6.3 7-6.3s6.2 2.1 7 6.3"/>',
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
  tracking: '<rect x="3.6" y="4" width="16.8" height="16" rx="5"/><path d="M7.4 9h9.2M7.4 13h6.4M7.4 17h4"/>',
  library: '<path d="M4.2 5.2A2.2 2.2 0 0 1 6.4 3h4.1c1 0 1.5.4 1.5 1.4V20c0-1.4-.8-2.2-2.2-2.2H4.2V5.2z"/><path d="M19.8 5.2A2.2 2.2 0 0 0 17.6 3h-4.1c-1 0-1.5.4-1.5 1.4V20c0-1.4.8-2.2 2.2-2.2h5.6V5.2z"/>',
  profile: '<circle cx="12" cy="8.1" r="3.4"/><path d="M5.2 20c.8-4.1 3-6.2 6.8-6.2s6 2.1 6.8 6.2"/>',
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
  const firstThreadId = uid();
  return {
    // rev/savedAt guard multi-tab writes. rev must stay the FIRST key so
    // revOfRaw() can read it off the raw string without a full JSON.parse.
    rev: 0,
    savedAt: 0,
    version: 1,
    settings: {
      name: "",
      nameSet: false,
      theme: "light",                // auto | light | dark - default Crystal light
      provider: "auto",              // auto | ollama | groq | offline
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "qwen3:8b",
      aeroCloudEnabled: false,        // current cloud-safe prompt only, never Lyfe context
      aeroSources: {
        today: true,
        tracking: true,
        library: true,
        connect: true,
        gmail: true,
        profile: true,
        knowledge: true,
      },
      aeroLocalLearning: true,
      aeroTrainingConsent: false,
      aeroProactiveMode: "brief",       // brief | important | quiet | off
      lastGreeted: "",
      sound: true,
      // profile, collected at onboarding after Google sign-in; Aero uses these
      age: "",
      country: "",
      username: "",
      headline: "",
      city: "",
      bio: "",
      website: "",
      profileInterests: [],
      connectSync: true,
      focus: [],                     // what they are here to do (goal areas)
      commitment: "",                // how committed: exploring | committed | all-in
      onboarded: false,
    },
    game: { xp: 0, streak: 0, lastActiveDay: "", bestStreak: 0, logins: [] },
    tasks: [],
    projects: [],
    goals: [],
    education: [],
    worklog: [],
    notes: [],
    docs: [],
    saved: [],
    chat: [],
    // Aero conversations are durable work objects. Messages stay in the
    // existing flat ledger for backwards compatibility and carry threadId.
    aeroThreads: [{
      id: firstThreadId,
      title: "New conversation",
      projectId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
    aeroAttention: {
      day: "",
      proactiveCount: 0,
      lastProactiveAt: 0,
      proactiveFingerprints: [],
      notifications: [],
    },
    aeroRuns: [],
    aeroActiveThreadId: firstThreadId,
    aero: window.AeroCore ? AeroCore.freshState() : { version: 1, memories: [], episodes: [], lastContext: null },
  };
}

function firstRunData() {
  const d = defaultData();
  const now = Date.now();
  d.notes.push({
    id: uid(),
    title: "Welcome to Lyfe",
    body:
`Lyfe keeps what matters close, and Aero helps you find your next step.

THE SHORT TOUR

Today - what needs you now, nothing more.
Aero - your personal intelligence. Ask what matters, use shorthand, or propose a task, note, project or work log. Aero shows every workspace change before applying it.
Tracking - tasks, projects, goals and work logs in one place.
Library - quick notes and longer docs together.
Profile - your identity, learning, and the details you choose to share with Connect.

GOOD TO KNOW

You can use Lyfe privately on this device or sign in to sync it. Gmail connects only when you choose it, and messages enter your Library only when you save them.
Aero can use Today, Tracking, Library, Connect, Gmail metadata and Profile only when you enable those sources. Its memory is typed, visible and yours to forget.`,
    pinned: true,
    createdAt: now,
    updatedAt: now,
  });
  d.chat.push(
    { id: uid(), threadId: d.aeroActiveThreadId, role: "sol", text: "I’m Aero. I use the Lyfe context you allow and preview every change.", ts: now },
    { id: uid(), threadId: d.aeroActiveThreadId, role: "sol", text: "Ask what matters now, or show me a workflow you repeat.", ts: now + 1 },
  );
  return d;
}

/* The consumer companion is now Aero. Keep the storage schema and
   internal view id stable, but repair old assistant-visible copy when an
   existing guest or cloud snapshot is opened after the rename. User-authored
   messages and notes are left untouched. */
function migrateLegacyCompanionText(value) {
  const migrated = String(value || "")
    .replace(/\b(?:SOL|EOS)\b/g, "AERO")
    .replace(/\b(?:Sol|Eos)\b/g, "Aero")
    .replace(/\b(?:sol|eos)\b/g, "aero");
  const legacyIntro = {
    "hey, i'm aero.": "I’m Aero.",
    "i carry the Lyfe context you allow, remember only what earns persistence, and preview every workspace change.": "I use the Lyfe context you allow and preview changes before they happen.",
    "start with \"what actually matters?\" or teach me a workflow you want to shorten over time.": "Ask what matters now, or show me a workflow you repeat.",
  };
  return legacyIntro[migrated] || migrated;
}

function normalize(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== "object") return base;
  for (const k of ["tasks", "projects", "goals", "education", "worklog", "notes", "docs", "saved", "chat"]) {
    base[k] = Array.isArray(raw[k]) ? raw[k].filter(x => x && typeof x === "object") : [];
  }
  base.chat = base.chat.map(message => Object.assign({}, message, {
    text: String(message.text || "").replace(/\s*[—–]\s*/g, ", "),
  }));
  base.chat = base.chat.map(message => {
    if (message.role === "user") return message;
    const text = migrateLegacyCompanionText(message.text);
    return text === message.text ? message : Object.assign({}, message, { text });
  });
  base.aeroThreads = Array.isArray(raw.aeroThreads)
    ? raw.aeroThreads.filter(thread => thread && typeof thread === "object" && thread.id).map(thread => ({
        id: String(thread.id),
        title: String(thread.title || "New conversation").slice(0, 90),
        projectId: thread.projectId == null ? null : String(thread.projectId),
        createdAt: Number(thread.createdAt || Date.now()),
        updatedAt: Number(thread.updatedAt || thread.createdAt || Date.now()),
      }))
    : [];
  if (!base.aeroThreads.length) {
    const id = String(raw.aeroActiveThreadId || uid());
    const firstUserMessage = base.chat.find(message => message.role === "user");
    base.aeroThreads = [{
      id,
      title: firstUserMessage ? String(firstUserMessage.text || "New conversation").slice(0, 90) : "New conversation",
      projectId: null,
      createdAt: base.chat[0] ? Number(base.chat[0].ts || Date.now()) : Date.now(),
      updatedAt: base.chat.length ? Number(base.chat[base.chat.length - 1].ts || Date.now()) : Date.now(),
    }];
  }
  base.aeroActiveThreadId = base.aeroThreads.some(thread => thread.id === String(raw.aeroActiveThreadId || ""))
    ? String(raw.aeroActiveThreadId)
    : base.aeroThreads[0].id;
  const knownThreadIds = new Set(base.aeroThreads.map(thread => thread.id));
  base.chat = base.chat.map(message => Object.assign({}, message, {
    threadId: knownThreadIds.has(String(message.threadId || "")) ? String(message.threadId) : base.aeroActiveThreadId,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.filter(item => item && /^data:image\/(?:jpeg|png|webp);base64,/i.test(String(item.data || ""))).slice(0, 3).map(item => ({
          id: String(item.id || uid()), data: String(item.data), w: Number(item.w || 0), h: Number(item.h || 0), name: String(item.name || "image").slice(0, 120),
        }))
      : [],
  }));
  base.aeroRuns = Array.isArray(raw.aeroRuns) && window.AeroHarness
    ? raw.aeroRuns.map(run => AeroHarness.normalize(run)).filter(Boolean).slice(-200)
    : [];
  base.notes = base.notes.map(note => {
    const body = String(note.body || "");
    const isOriginalWelcome = note.title === "Welcome to Lyfe" && note.pinned === true
      && /Lyfe keeps (?:everything in one calm place|what matters close)/i.test(body)
      && /\b(?:sol|eos)\b/i.test(body);
    if (!isOriginalWelcome) return note;
    const migratedBody = migrateLegacyCompanionText(body);
    return migratedBody === body ? note : Object.assign({}, note, { body: migratedBody });
  });
  if (raw.settings && typeof raw.settings === "object") {
    base.settings = Object.assign(base.settings, raw.settings);
  }
  base.settings.aeroSources = Object.assign({
    today: true, tracking: true, library: true, connect: true, gmail: true, profile: true, knowledge: true,
  }, raw.settings && raw.settings.aeroSources && typeof raw.settings.aeroSources === "object" ? raw.settings.aeroSources : {});
  base.settings.aeroLocalLearning = base.settings.aeroLocalLearning !== false;
  base.settings.aeroTrainingConsent = base.settings.aeroTrainingConsent === true;
  base.settings.aeroCloudEnabled = base.settings.aeroCloudEnabled === true;
  if (!["brief", "important", "quiet", "off"].includes(base.settings.aeroProactiveMode)) base.settings.aeroProactiveMode = "brief";
  const rawAttention = raw.aeroAttention && typeof raw.aeroAttention === "object" ? raw.aeroAttention : {};
  base.aeroAttention = {
    day: String(rawAttention.day || ""),
    proactiveCount: Math.max(0, Math.min(2, Number(rawAttention.proactiveCount || 0))),
    lastProactiveAt: Number(rawAttention.lastProactiveAt || 0),
    proactiveFingerprints: Array.isArray(rawAttention.proactiveFingerprints) ? rawAttention.proactiveFingerprints.map(String).slice(-40) : [],
    notifications: Array.isArray(rawAttention.notifications) ? rawAttention.notifications.filter(item => item && item.id && item.title).slice(0, 60).map(item => ({
      id: String(item.id), fingerprint: String(item.fingerprint || item.id), title: String(item.title).slice(0, 160),
      detail: String(item.detail || "").slice(0, 360), prompt: String(item.prompt || "").slice(0, 500),
      priority: ["urgent", "important", "normal"].includes(item.priority) ? item.priority : "normal",
      createdAt: Number(item.createdAt || Date.now()), read: item.read === true,
    })) : [],
  };
  // Retire legacy direct-browser cloud credentials. Consumer subscriptions are
  // not API credentials, and private Lyfe context must never leave through an
  // old saved provider setting.
  if (!["auto", "ollama", "groq", "offline"].includes(base.settings.provider)) base.settings.provider = "auto";
  delete base.settings.apiKey;
  delete base.settings.model;
  delete base.settings.aeroCloudContext;
  base.settings.profileInterests = Array.isArray(base.settings.profileInterests)
    ? base.settings.profileInterests.map(String).filter(Boolean).slice(0, 12)
    : [];
  base.settings.connectSync = base.settings.connectSync !== false;
  // older builds shipped "Aman" as the default name; clear that leftover so no
  // one ever sees it. `nameSet` is true only once the user actually chooses a
  // name (onboarding or Settings), so a deliberately kept "Aman" survives while
  // the stale default is wiped, whatever the onboarded flag says.
  if (raw.settings && base.settings.name === "Aman" && !base.settings.nameSet) {
    base.settings.name = "";
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
  base.aero = window.AeroCore ? AeroCore.normalize(raw.aero) : (raw.aero || base.aero);
  return base;
}

function loadData() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
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
  try { return revOfRaw(localStorage.getItem(ACTIVE_KEY)); }
  catch (e) { return -1; }
}

function save(force, immediateCloud) {
  try {
    const stored = storedRev();
    if (!force && stored > (state.data.rev || 0)) {
      // another tab wrote a newer revision we haven't absorbed yet; the
      // queued storage/visibility events will fold it in - don't clobber it
      return false;
    }
    state.data.rev = Math.max(state.data.rev || 0, stored) + 1;
    state.data.savedAt = Date.now();
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.data));
    padDirty = false;
    // Most edits are safely debounced. Action decisions and learning signals
    // flush immediately so a fast reload cannot resurrect a dismissed preview
    // or lose feedback that should personalize Aero.
    if (CLOUD_MODE && window.LyfeCloud) {
      if (immediateCloud) LyfeCloud.push(state.data, state.data.rev).catch(function () { /* local cache remains authoritative offline */ });
      else LyfeCloud.pushDebounced(state.data, state.data.rev);
    }
    return true;
  } catch (e) {
    toast("Could not save - storage may be full");
    return false;
  }
}

const state = {
  data: loadData(),
  cloudRev: 0,
  view: "today",
  trackingView: "tasks",
  libraryView: "notes",
  profileView: "profile",
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
  calmIndex: Math.floor(Math.random() * 100000),
  aeroSourceView: "today",
  aeroObject: null,
};

function activeAeroThread() {
  let thread = state.data.aeroThreads.find(item => item.id === state.data.aeroActiveThreadId);
  if (!thread) {
    thread = state.data.aeroThreads[0];
    if (thread) state.data.aeroActiveThreadId = thread.id;
  }
  return thread || null;
}

function activeAeroMessages() {
  const thread = activeAeroThread();
  return thread ? state.data.chat.filter(message => message.threadId === thread.id) : [];
}

function titleFromAeroPrompt(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Image conversation";
  return clean.length > 52 ? clean.slice(0, 51).trimEnd() + "…" : clean;
}

function createAeroThread(projectId, title) {
  const now = Date.now();
  const thread = {
    id: uid(),
    title: String(title || "New conversation").slice(0, 90),
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  };
  state.data.aeroThreads.unshift(thread);
  state.data.aeroActiveThreadId = thread.id;
  state.data.chat.push({
    id: uid(), threadId: thread.id, role: "sol",
    text: projectId ? "Project workspace ready. What should move?" : "What should we work on?",
    ts: now,
  });
  save();
  return thread;
}

function switchAeroThread(id) {
  const thread = state.data.aeroThreads.find(item => item.id === id);
  if (!thread) return false;
  state.data.aeroActiveThreadId = thread.id;
  const project = thread.projectId && state.data.projects.find(item => item.id === thread.projectId);
  if (project) {
    state.aeroSourceView = "tracking";
    state.aeroObject = { type: "project", id: project.id, title: project.name, detail: project.description || "Active project" };
  } else {
    state.aeroObject = null;
  }
  save();
  return true;
}

let aeroDraftImages = [];
let aeroRecognition = null;
let aeroListening = false;
// One-use server authority is intentionally memory-only. Persisting this map
// would turn a review token into a replayable account credential.
const aeroServerAuthority = new Map();
const AERO_SERVER_ACTIONS = new Set([
  "add_task", "complete_task", "add_note", "add_doc", "log_work",
  "add_goal", "add_education", "add_project",
]);
const AERO_MEMORY_ACTIONS = new Set(["memory_upsert", "memory_forget"]);
let aeroMemoryAuthorityError = "";
let aeroPresenceStatus = { loaded: false, loading: false, supported: false, enrolled: false, credentials: [] };

let gmailMessages = [];
let gmailLoading = false;
let gmailLoaded = false;
let gmailError = "";

function gmailHeader(message, name) {
  const headers = message && message.payload && Array.isArray(message.payload.headers)
    ? message.payload.headers : [];
  const hit = headers.find(header => String(header.name || "").toLowerCase() === name.toLowerCase());
  return hit ? String(hit.value || "") : "";
}

function gmailSender(value) {
  const raw = String(value || "").trim();
  const named = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  return (named ? named[1] : raw.replace(/<[^>]+>/g, "")).trim() || "Unknown sender";
}

function gmailRailHtml() {
  const token = !!(window.LyfeCloud && LyfeCloud.gmailToken);
  const connecting = !!(window.LyfeCloud && LyfeCloud.gmailConnecting);
  let body = "";
  if (!token) {
    body = `<div class="gmail-empty"><span class="gmail-g">G</span><div><strong>${connecting ? "Opening Google…" : "Connect Gmail"}</strong><small>Read-only inbox signals. Saving is always explicit.</small></div><button class="btn btn-primary" type="button" data-action="gmail-connect" ${connecting ? "disabled" : ""}>${connecting ? "Connecting…" : "Connect"}</button></div>`;
  } else if (gmailLoading) {
    body = `<div class="gmail-empty"><span class="gmail-g">G</span><div><strong>Opening your inbox...</strong><small>Fetching the latest messages.</small></div></div>`;
  } else if (gmailError) {
    body = `<div class="gmail-empty"><span class="gmail-g">G</span><div><strong>Gmail needs permission again</strong><small>${esc(gmailError)}</small></div><button class="btn" type="button" data-action="gmail-connect">Reconnect</button></div>`;
  } else if (!gmailMessages.length && gmailLoaded) {
    body = `<div class="gmail-empty"><span class="gmail-g">G</span><div><strong>Your inbox is clear</strong><small>No recent inbox messages to show.</small></div><button class="btn" type="button" data-action="gmail-refresh">Refresh</button></div>`;
  } else {
    body = `<div class="gmail-track" id="gmail-track">${gmailMessages.slice(0, 6).map(message => {
      const alreadySaved = state.data.saved.some(item => item.source === "Gmail" && item.sourceId === message.id);
      return `<article class="gmail-card"><header><span>${esc(message.sender)}</span><time>${esc(message.date)}</time></header><h3>${esc(message.subject || "(no subject)")}</h3><p>${esc(message.snippet)}</p><div class="gmail-card-actions"><button type="button" data-action="gmail-save" data-id="${esc(message.id)}" ${alreadySaved ? "disabled" : ""}>${alreadySaved ? "Saved" : "Save to Library"}</button><button type="button" data-action="aero-from-source" data-source="gmail" data-id="${esc(message.id)}">Ask Aero</button></div></article>`;
    }).join("")}</div>`;
  }
  return `<section class="home-gmail panel" id="gmail-home"><header><div><span class="eyebrow">INBOX SIGNALS / READ-ONLY</span><h2>Gmail, without the feed.</h2></div><div class="gmail-controls"><button type="button" data-action="aero-from-source" data-source="gmail" data-prompt="scan my recent inbox and tell me only what needs action">Ask Aero</button>${token ? `<button type="button" data-action="gmail-refresh" aria-label="Refresh Gmail">Refresh</button>` : ""}<button type="button" data-action="gmail-scroll" data-dir="-1" aria-label="Scroll inbox left">←</button><button type="button" data-action="gmail-scroll" data-dir="1" aria-label="Scroll inbox right">→</button></div></header>${body}</section>`;
}

function refreshGmailRail() {
  const current = document.getElementById("gmail-home");
  if (current) current.outerHTML = gmailRailHtml();
}

async function loadGmailInbox(force) {
  const token = window.LyfeCloud && LyfeCloud.gmailToken;
  if (!token || gmailLoading || (gmailLoaded && !force)) return;
  gmailLoading = true;
  gmailError = "";
  refreshGmailRail();
  try {
    const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!listResponse.ok) {
      if ((listResponse.status === 401 || listResponse.status === 403) && window.LyfeCloud && LyfeCloud.clearGmailToken) LyfeCloud.clearGmailToken();
      throw new Error(listResponse.status === 401 || listResponse.status === 403 ? "Google access expired. Reconnect once to continue." : "Gmail is unavailable right now.");
    }
    const list = await listResponse.json();
    const ids = Array.isArray(list.messages) ? list.messages.slice(0, 10) : [];
    const details = await Promise.all(ids.map(async item => {
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(item.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) return null;
      const message = await response.json();
      const rawDate = gmailHeader(message, "Date");
      const parsedDate = rawDate ? new Date(rawDate) : null;
      return {
        id: String(message.id || item.id),
        sender: gmailSender(gmailHeader(message, "From")),
        subject: gmailHeader(message, "Subject"),
        snippet: String(message.snippet || "").slice(0, 240),
        date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""
      };
    }));
    gmailMessages = details.filter(Boolean);
    gmailLoaded = true;
  } catch (error) {
    gmailError = error && error.message ? error.message : "Gmail is unavailable right now.";
    gmailLoaded = false;
  } finally {
    gmailLoading = false;
    refreshGmailRail();
  }
}

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

let modalReturnFocus = null;

function activateDialog(root) {
  const dialog = root && root.querySelector('[role="dialog"]');
  if (!dialog) return;
  const heading = dialog.querySelector("h1, h2, h3");
  if (heading && !dialog.getAttribute("aria-label")) {
    heading.id = "lyfe-modal-title";
    dialog.setAttribute("aria-labelledby", heading.id);
  }
  const app = document.getElementById("app");
  if (app) {
    app.inert = true;
    app.setAttribute("inert", "");
    app.setAttribute("aria-hidden", "true");
  }
  document.body.classList.add("modal-open");
  setTimeout(() => {
    const el = dialog.querySelector('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    if (el) el.focus();
    else { dialog.setAttribute("tabindex", "-1"); dialog.focus(); }
  }, 0);
}

function openModal(inner, dialogClass) {
  const root = document.getElementById("modal-root");
  modalReturnFocus = document.activeElement;
  root.innerHTML =
    `<div class="overlay" data-action="overlay-close"><div class="modal${dialogClass ? " " + esc(dialogClass) : ""}" role="dialog" aria-modal="true">${inner}</div></div>`;
  activateDialog(root);
}

function closeModal() {
  const returnTo = modalReturnFocus;
  modalReturnFocus = null;
  document.getElementById("modal-root").innerHTML = "";
  const app = document.getElementById("app");
  if (app) {
    app.inert = false;
    app.removeAttribute("inert");
    app.removeAttribute("aria-hidden");
  }
  document.body.classList.remove("modal-open");
  confirmCb = null;
  setTimeout(() => { if (returnTo && returnTo.isConnected) returnTo.focus(); }, 0);
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
      title="${done ? "Mark as not done" : "Mark as done"}" aria-label="${done ? "Mark task as open" : "Mark task as done"}: ${esc(t.title)}">${done ? "✓" : ""}</button>
    <div class="task-title">${!done && t.important ? `<span class="imp-flag" title="Important - will alarm">⚑</span>` : ""}${esc(t.title)}${!done && t.priority === "High" ? `<span class="prio-flag" title="High priority">!</span>` : ""}</div>
    ${side}
    <span class="row-actions">
      ${!done && t.due && t.due < todayStr() ? `<button class="icon-btn" data-action="snooze-task" data-id="${esc(t.id)}" title="Push to tomorrow" aria-label="Push ${esc(t.title)} to tomorrow">↷</button>` : ""}
      <button class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" title="Edit" aria-label="Edit task: ${esc(t.title)}">✎</button>
      <button class="icon-btn" data-action="delete-task" data-id="${esc(t.id)}" title="Delete" aria-label="Delete task: ${esc(t.title)}">✕</button>
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

function viewTodayLegacy() {
  const d = state.data;
  const t = todayStr();
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const partCap = part.charAt(0).toUpperCase() + part.slice(1);   // "Good Morning"
  const name = (d.settings.name || "").trim();
  const who = name || "Human";   // greeting knows their name once onboarded

  const open = d.tasks.filter(x => x.status !== "done");
  const overdue = open.filter(x => x.due && x.due < t).sort(taskCmp);
  const dueToday = open.filter(x => x.due === t).sort(taskCmp);
  const doneToday = d.tasks
    .filter(x => x.status === "done" && x.completedAt && isoOf(new Date(x.completedAt)) === t)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const allActiveProjects = d.projects.filter(p => p.status === "active")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const activeProjects = allActiveProjects.slice(0, 3);
  const recentNotes = d.notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
  const connectSuite = readConnectSuiteState();
  const workspacePins = (connectSuite.savedReels || []).length +
    (connectSuite.savedOpportunities || []).length +
    (connectSuite.pinnedMessages || []).length;
  const homeTabs = `<nav class="home-tabs" aria-label="Quick views">
    <button class="home-tab" type="button" data-action="home-tab" data-home-tab="pins"><span>Pins</span><b>${workspacePins}</b></button>
    <button class="home-tab" type="button" data-action="home-tab" data-home-tab="projects"><span>Projects</span><b>${allActiveProjects.length}</b></button>
    <button class="home-tab" type="button" data-action="home-tab" data-home-tab="pending"><span>Pending</span><b>${open.length}</b></button>
  </nav>`;

  const wh = weekHours();

  const wanderPlace = PLACES[state.wanderIndex % PLACES.length];
  const wanderFact = FACTS[state.factIndex % FACTS.length];
  const [wanderName, wanderCountry, wanderBlurb, wanderWiki] = wanderPlace;
  const wanderHome = `<section class="home-wander" aria-labelledby="home-wander-title">
    <div class="home-wander-head"><div><span class="eyebrow">WANDER / A FIVE MINUTE WINDOW</span><h2 id="home-wander-title">Put a little world back into the day.</h2></div><div><button class="btn" data-action="save-wander">Keep this</button><button class="btn btn-primary" data-action="new-wander">Somewhere else ↗</button></div></div>
    <section class="wander-hero home-wander-hero tilt" data-wiki="${esc(wanderWiki)}">
      <div class="wander-loading" aria-hidden="true"><i></i><span class="wl-tuning">TUNING SIGNAL..</span><span class="wl-lost">NO SIGNAL · IMAGINE IT..</span></div>
      <img id="wander-photo" alt="${esc(wanderName)}, ${esc(wanderCountry)}">
      <div class="wander-scan" aria-hidden="true"></div>
      <div class="wander-meta"><span>PLACE ${String(state.wanderIndex + 1).padStart(3, "0")} / ${PLACES.length}</span><span>LOOK UP · BREATHE OUT</span></div>
      <div class="wander-copy"><span>${esc(wanderCountry)}</span><h3>${esc(wanderName)}</h3><p>${esc(wanderBlurb)}</p></div>
    </section>
    <section class="fact-panel home-fact"><span class="eyebrow">STRANGE BUT TRUE</span><p>${esc(wanderFact)}</p><button class="linklike" data-action="new-fact">another fact ↻</button></section>
  </section>`;

  const calmHome = `<section class="panel tilt calm-card home-calm cx-moment" aria-labelledby="home-calm-title">
    <img class="calm-img" alt="A quiet landscape selected for a short pause" loading="lazy"
      src="https://picsum.photos/seed/lyfe-calm-${state.calmIndex}/1400/700"
      onerror="this.closest('.calm-card').style.display='none'">
    <div class="calm-cap"><div><span class="eyebrow">MOMENT OF CALM</span><strong id="home-calm-title">A small pause before the next thing.</strong></div><button class="btn" type="button" data-action="new-calm">Explore again ↻</button></div>
  </section>`;

  const connectActivity = connectSummary();
  const connectInbox = `<a class="connect-inbox-card" href="connect.html#notifications">
    <span class="connect-inbox-icon"><img src="../assets/lyfe_connect_logo.svg" alt=""></span>
    <span class="connect-inbox-copy"><span class="eyebrow">CONNECT NOTIFICATIONS</span><strong>${connectActivity.unread ? connectActivity.unread + " unread update" + (connectActivity.unread === 1 ? "" : "s") : "Your Connect inbox is quiet."}</strong><small>${esc(connectActivity.latest)}</small></span>
    <span class="connect-inbox-meta"><b>${connectActivity.threads}</b> drafts · <b>${connectActivity.saved}</b> saved</span>
  </a>`;

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
        <div class="mini-row mini-note" role="button" tabindex="0" data-action="open-note" data-id="${esc(n.id)}" aria-label="Open note: ${esc((n.title || "").trim() || "Untitled")}">
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
  const aeroHomeThought = overdue.length
    ? "One thing slipped. Pick it up or give it a new date."
    : "Nothing is urgent. Use the space well.";
  const aeroHomeBody = `<div class="aero-home-lockup"><img src="../assets/aero_logo.svg" alt=""><span><small>AERO</small><b>Ready with your Lyfe context</b></span></div>
    <h2>${aeroHomeThought}</h2>
    <div class="aero-home-prompts" aria-label="Ask Aero">
      <button type="button" data-action="aero-from-source" data-source="today" data-prompt="what actually matters right now?">what matters?</button>
      <button type="button" data-action="aero-from-source" data-source="today" data-prompt="plan my next focused hour">plan an hour</button>
      <button type="button" data-action="aero-from-source" data-source="today" data-prompt="what changed across my Lyfe?">what changed?</button>
    </div>
    <button class="btn" data-action="nav" data-view="sol">Open Aero</button>`;

  // the two identities are two different buildings on the same data.
  // CRYSTAL (light): glass showroom - 3D disc hero, bento deck, holo endcap.
  if (resolvedTheme() === "light") {
    const learning = d.education.filter(x => x.status === "in-progress").length;
    return `<div class="cx-stage">
    <section class="cx-hero" data-reveal>
      <div class="cx-hero-copy">
        <div class="cx-kicker home-index">LYFE ::CRYSTAL • ${esc(fmtLongISO(t))}</div>
        <h1 class="cx-title">Good ${partCap},<br>${esc(who)}<span class="blink-dot">.</span></h1>
        <p class="cx-deck">${open.length
          ? `<b>${open.length} open loop${open.length === 1 ? "" : "s"}</b> in orbit - everything else is handled.`
          : `Nothing waiting on you. <b>Choose what deserves your attention.</b>`}</p>
        <div class="cx-cta">
          <button class="btn btn-primary cx-btn-big" data-action="new-task">+ capture</button>
          <button class="btn cx-btn-big" data-action="nav" data-view="sol">${icon("sol")} talk to Aero</button>
        </div>
      </div>

      <div class="cx-hero-disc" aria-hidden="true">
        <div class="cx-float">
          <i class="cx-petal p1"></i><i class="cx-petal p2"></i><i class="cx-petal p3"></i>
          <div class="cx-core">
            <i class="cx-core-ring rb"></i>
            <span class="cx-core-logo"><img src="../assets/aero_logo.svg" alt=""></span>
            <i class="cx-core-ring rf"></i>
            <i class="cx-core-orbiter"><i></i></i>
            <span class="cx-core-badge">::2K</span>
            <span class="cx-core-label">personal system · crystal</span>
          </div>
          <span class="cx-glint g1"></span><span class="cx-glint g2"></span><span class="cx-glint g3"></span>
        </div>
      </div>

      <div class="cx-stats">
        <button class="cx-stat" data-action="nav" data-view="tasks"><b>${overdue.length + dueToday.length}</b><span>due now</span></button>
        <button class="cx-stat" data-action="nav" data-view="projects"><b>${activeProjects.length}</b><span>projects live</span></button>
        <button class="cx-stat" data-action="nav" data-view="work"><b>${fmtHours(wh)}h</b><span>work logged</span></button>
        <button class="cx-stat" data-action="nav" data-view="education"><b>${learning}</b><span>learning</span></button>
        <button class="cx-stat cx-stat-sol" data-action="nav" data-view="sol">${aeroBrandMark(30, "aero-home-status")}<span>aero</span></button>
      </div>
    </section>

    ${homeTabs}

    ${gmailRailHtml()}

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
        ${aeroHomeBody}
      </section>

      <a class="cx-connect-card" href="connect.html">
        <span class="cx-connect-mark"><img src="../assets/lyfe_connect_logo.svg" alt=""></span>
        <span class="cx-connect-copy"><span class="eyebrow">LYFE CONNECT / PRIVATE PREVIEW</span><strong>Find the people and rooms your work needs.</strong><span>A calmer network for collaborators, work posts, focused Circles, and shared project pages.</span></span>
        <span class="cx-connect-link">OPEN CONNECT <span aria-hidden="true">↗</span></span>
      </a>
      ${connectInbox}
    </section>

    <div class="home-reset-deck">${wanderHome}${calmHome}</div>

    <section class="cx-endcap" data-reveal>
      <i class="cx-endcap-disc" aria-hidden="true"></i>
      <span class="cx-endcap-kicker">START WHERE YOU ARE.</span>
      <h2>Choose one thing.<br>Begin there.</h2>
      <a class="btn btn-primary" href="#home-wander-title">open Wander ${icon("wander")}</a>
    </section>
  </div>`;
  }

  // ORBIT (dark): the cinematic control room, unchanged.
  return `<div class="home-stage">
    <section class="home-intro">
      <div class="home-index">LYFE / ${String(new Date().getMonth() + 1).padStart(2, "0")}.${String(new Date().getDate()).padStart(2, "0")}</div>
      <div class="home-title-row">
        <h1>Good ${partCap}, ${esc(who)}<span class="blink-dot">.</span></h1>
        <div class="home-actions">
          <button class="btn ghost-pill" data-action="nav" data-view="sol">${icon("sol")} talk to Aero</button>
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
      <button class="sol-chip" data-action="nav" data-view="sol" aria-label="Open Aero">
        ${aeroBrandMark(42, "aero-home-status")}
        <span class="sol-chip-txt">
          <span class="sol-chip-main">AERO</span>
          <span class="sol-chip-sub">tap to use your Lyfe context</span>
        </span>
      </button>
      <div class="orbit-dock">
        <button data-action="nav" data-view="tasks"><b>${overdue.length + dueToday.length}</b><span>due now</span></button>
        <button data-action="nav" data-view="projects"><b>${activeProjects.length}</b><span>projects</span></button>
        <button data-action="nav" data-view="work"><b>${fmtHours(wh)}h</b><span>work logged</span></button>
        <button data-action="nav" data-view="education"><b>${d.education.filter(x => x.status === "in-progress").length}</b><span>learning</span></button>
      </div>
    </section>

    ${homeTabs}

    ${gmailRailHtml()}

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
          ${aeroHomeBody}
        </section>
        <a class="panel tilt connect-card" href="connect.html">
          <span class="connect-card-mark"><img src="../assets/lyfe_connect_logo.svg" alt=""></span>
          <span class="eyebrow">LYFE CONNECT / PRIVATE PREVIEW</span>
          <strong>Find the people and rooms your work needs.</strong>
          <span>Discover collaborators, share work in context, and turn a useful thread into organized action.</span>
          <span class="btn">open connect <span aria-hidden="true">↗</span></span>
        </a>
        ${connectInbox}
      </div>
    </section>

    <div class="home-reset-deck">${wanderHome}${calmHome}</div>

    <section class="home-endcap">
      <span>START WHERE YOU ARE.</span>
      <h2>Choose one thing.<br>Begin there.</h2>
      <a class="btn btn-primary" href="#home-wander-title">open Wander ${icon("wander")}</a>
    </section>
  </div>`;
}

/* Today is the attention layer of Lyfe. It deliberately shows less than the
   underlying product: one brief, a ranked queue, external signals, and living
   workspaces. Aero is the synthesis and action layer across all of them. */
function viewTodayAttentionDashboard() {
  const d = state.data;
  const today = todayStr();
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = (d.settings.name || "").trim() || "Human";

  const open = d.tasks.filter(task => task.status !== "done");
  const overdue = open.filter(task => task.due && task.due < today).sort(taskCmp);
  const dueToday = open.filter(task => task.due === today).sort(taskCmp);
  const remaining = open.filter(task => !overdue.includes(task) && !dueToday.includes(task)).sort((a, b) => {
    const importantA = a.important || a.priority === "High" ? 0 : 1;
    const importantB = b.important || b.priority === "High" ? 0 : 1;
    return importantA - importantB || taskCmp(a, b);
  });
  const attentionTasks = overdue.concat(dueToday, remaining).slice(0, 5);
  const attentionCount = overdue.length + dueToday.length;
  const doneToday = d.tasks.filter(task =>
    task.status === "done" && task.completedAt && isoOf(new Date(task.completedAt)) === today
  ).length;

  const activeProjects = d.projects.filter(project => project.status === "active")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4);
  const recentNotes = d.notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
  const connectActivity = connectSummary();
  const context = aeroContextPack("today");
  const metrics = window.AeroCore ? AeroCore.metrics(d.aero) : {
    activeMemories: 0, compressionSamples: 0, compression: null, firstPassRate: null,
  };
  const gmailConnected = !!(window.LyfeCloud && LyfeCloud.gmailToken);
  const signalCount = connectActivity.unread + (gmailConnected ? gmailMessages.length : 0);
  const sourceLabels = context.sources.map(source => aeroSourceLabel(source.id));

  const briefTitle = overdue.length
    ? `${overdue.length} overdue ${overdue.length === 1 ? "commitment needs" : "commitments need"} a decision.`
    : dueToday.length
      ? `${dueToday.length} ${dueToday.length === 1 ? "thing needs" : "things need"} you today.`
      : open.length
        ? `${open.length} open ${open.length === 1 ? "loop is" : "loops are"} held. None is urgent.`
        : "The system is quiet. Choose what matters next.";
  const briefDetail = activeProjects.length
    ? `${activeProjects.length} active ${activeProjects.length === 1 ? "workspace" : "workspaces"} · ${signalCount} new ${signalCount === 1 ? "signal" : "signals"} · ${doneToday} finished today.`
    : `${signalCount} new ${signalCount === 1 ? "signal" : "signals"} · ${doneToday} finished today. Capture an outcome when you are ready.`;

  const attentionList = attentionTasks.length
    ? `<ul class="task-list today-task-list">${attentionTasks.map(task => taskRow(task)).join("")}</ul>`
    : emptyState("Nothing needs your attention right now.");

  const projectList = activeProjects.length
    ? activeProjects.map(project => `
        <button class="today-project-row" type="button" data-action="nav" data-view="projects">
          <span><strong>${esc(project.name)}</strong><small>${esc(project.description || "Active workspace")}</small></span>
          ${bar(project.progress || 0)}
        </button>`).join("")
    : `<div class="today-module-empty"><strong>No active workspaces.</strong><span>Turn an outcome into a project when it needs history, decisions and momentum.</span><button class="btn btn-sm" data-action="new-project">Create project</button></div>`;

  const noteList = recentNotes.length
    ? recentNotes.map(note => `
        <button class="today-context-row" type="button" data-action="open-note" data-id="${esc(note.id)}">
          <span>${note.pinned ? "PINNED NOTE" : "NOTE"}</span>
          <strong>${esc((note.title || "").trim() || "Untitled")}</strong>
          <small>${esc(snippet(note.body))}</small>
        </button>`).join("")
    : `<div class="today-module-empty"><strong>Your Library is ready.</strong><span>Save the context you will want Aero to recover later.</span><button class="btn btn-sm" data-action="new-note">Add note</button></div>`;

  const learningLine = metrics.compressionSamples > 0 && metrics.compression != null
    ? metrics.compression > 0 && metrics.intentAccuracyDelta != null && metrics.intentAccuracyDelta >= -0.02
      ? `${Math.round(metrics.compression * 100)}% less restating across rated repeats, without lower first-pass accuracy.`
      : metrics.compression > 0
        ? `You are saying less, but first-pass accuracy has not held yet.`
        : "No reliable communication compression yet. Aero is still learning the baseline."
    : "Learning begins only after repeated, user-rated workflows.";

  return `<div class="today-system">
    <section class="today-hero" aria-labelledby="today-title">
      <div class="today-topline">
        <span>LYFE / ${esc(fmtLongISO(today))}</span>
        <span class="today-live"><i></i> AERO CONTEXT READY</span>
      </div>

      <div class="today-hero-grid">
        <div class="today-hero-copy">
          <span class="eyebrow">YOUR ATTENTION, NOT ANOTHER FEED</span>
          <h1 id="today-title">Good <span class="today-greeting-word">${esc(part)}</span>, ${esc(name)}<span class="blink-dot">.</span></h1>
          <h2>${esc(briefTitle)}</h2>
          <p>${esc(briefDetail)}</p>
          <div class="today-hero-actions">
            <button class="btn btn-primary" type="button" data-action="aero-from-source" data-source="today" data-prompt="what actually matters right now, and why?">Ask Aero what matters</button>
            <button class="btn" type="button" data-action="new-task">Quick capture</button>
          </div>
        </div>

        <aside class="today-aero-presence" aria-label="Aero context status">
          <div class="today-aero-lockup">
            <span class="today-logo"><img src="../assets/aero_logo.svg" alt="Aero"></span>
            <span><b>Aero</b><small>across Lyfe</small></span>
          </div>
          <p>${sourceLabels.length} connected context ${sourceLabels.length === 1 ? "source" : "sources"} are available for this brief.</p>
          <div class="today-source-chips">${sourceLabels.map(label => `<span>${esc(label)}</span>`).join("")}</div>
          <small class="today-learning-line">${esc(learningLine)}</small>
          <button class="linklike" type="button" data-action="nav" data-view="sol">Open Aero workspace →</button>
        </aside>
      </div>

      <div class="today-metrics" aria-label="Today at a glance">
        <button type="button" data-action="nav" data-view="tasks"><b>${attentionCount}</b><span>need attention</span></button>
        <button type="button" data-action="nav" data-view="projects"><b>${activeProjects.length}</b><span>active workspaces</span></button>
        <a href="connect.html#notifications"><b>${signalCount}</b><span>new signals</span></a>
        <button type="button" data-action="nav" data-view="sol"><b>${metrics.activeMemories || 0}</b><span>trusted memories</span></button>
      </div>
    </section>

    <section class="today-main-grid">
      <section class="panel today-attention-card">
        <header>
          <div><span class="eyebrow">01 / ATTENTION</span><h2>Only the next five.</h2></div>
          <button class="linklike" type="button" data-action="nav" data-view="tasks">View all ${open.length} →</button>
        </header>
        <form class="quick-add command-add" data-form="quick-task-today">
          <span>+</span>
          <input type="text" id="qa-title" name="title" maxlength="200" placeholder="Capture a commitment…" autocomplete="off">
          <button class="btn btn-primary btn-sm" type="submit">Add</button>
        </form>
        ${attentionList}
      </section>

      <section class="panel today-aero-actions">
        <span class="eyebrow">02 / ASK WITH CONTEXT</span>
        <h2>Say the short version.</h2>
        <p>Aero already has the Lyfe surfaces you allowed. Start with the outcome, not the backstory.</p>
        <div class="today-prompt-list">
          <button type="button" data-action="aero-from-source" data-source="today" data-prompt="plan my next focused block">Plan my next block <span>→</span></button>
          <button type="button" data-action="aero-from-source" data-source="today" data-prompt="catch me up on what changed">Catch me up <span>→</span></button>
          <button type="button" data-action="aero-from-source" data-source="today" data-prompt="where am i blocked?">Find the blocker <span>→</span></button>
          <button type="button" data-action="aero-from-source" data-source="connect" data-prompt="who needs a follow-up, and what should i say?">Prepare follow-ups <span>→</span></button>
        </div>
      </section>
    </section>

    ${gmailRailHtml()}

    <section class="today-section-head">
      <div><span class="eyebrow">03 / LIVING CONTEXT</span><h2>Workspaces, memory and people.</h2></div>
      <p>The durable state behind the brief. Aero reads only the sources you enable.</p>
    </section>
    <section class="today-workspace-grid">
      <section class="panel today-module">
        <header><div><span class="eyebrow">TRACKING</span><h2>Active workspaces</h2></div><button class="linklike" type="button" data-action="nav" data-view="projects">Open →</button></header>
        <div>${projectList}</div>
      </section>
      <section class="panel today-module">
        <header><div><span class="eyebrow">LIBRARY</span><h2>Recent context</h2></div><button class="linklike" type="button" data-action="nav" data-view="notes">Open →</button></header>
        <div>${noteList}</div>
      </section>
      <a class="panel today-connect-module" href="connect.html">
        <div class="today-connect-head"><img src="../assets/lyfe_connect_logo.svg" alt=""><span class="eyebrow">LYFE CONNECT</span></div>
        <h2>People are part of the work.</h2>
        <p>${connectActivity.unread ? esc(connectActivity.latest) : "Conversations, collaborators and saved opportunities become usable Aero context."}</p>
        <div class="today-connect-stats"><span><b>${connectActivity.unread}</b> unread</span><span><b>${connectActivity.threads}</b> threads</span><span><b>${connectActivity.saved}</b> saved</span></div>
        <span class="today-connect-open">Open Connect →</span>
      </a>
    </section>
  </div>`;
}

function viewToday() {
  return viewTodayAttentionDashboard();
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

function sectionTabs(group, current) {
  const sets = {
    tracking: [["tasks", "Tasks"], ["projects", "Projects"], ["goals", "Goals"], ["work", "Work log"]],
    library: [["notes", "Notes"], ["docs", "Docs"], ["saved", "Saved"], ["aero-work", "Aero work"]],
    profile: [["profile", "Profile"], ["education", "Learning"]],
  };
  const tabs = sets[group] || [];
  return `<nav class="section-tabs" aria-label="${esc(group)} sections">${tabs.map(([id, label]) =>
    `<button type="button" class="section-tab ${current === id ? "active" : ""}" data-action="nav" data-view="${id}" aria-pressed="${current === id}">${esc(label)}</button>`
  ).join("")}</nav>`;
}

function readConnectState() {
  try {
    const raw = JSON.parse(localStorage.getItem("lyfe.connect.preview.v1") || "null");
    return raw && typeof raw === "object" ? raw : null;
  } catch (e) {
    return null;
  }
}

function readConnectSuiteState() {
  try {
    const raw = JSON.parse(localStorage.getItem("lyfe.connect.suite.v1") || "null");
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function connectSummary() {
  const connect = readConnectState() || {};
  const notifications = Array.isArray(connect.notifications) ? connect.notifications : [];
  const unread = notifications.filter(item => !item.read).length;
  const latest = notifications[0] && notifications[0].text
    ? String(notifications[0].text)
    : "Your Connect activity and conversations will appear here.";
  return {
    unread,
    latest,
    saved: Array.isArray(connect.saved) ? connect.saved.length : 0,
    threads: Array.isArray(connect.conversations) ? connect.conversations.length : 0,
  };
}

function aeroActiveObject() {
  const d = state.data;
  if (state.view === "notes" && state.noteId) {
    const note = d.notes.find(item => item.id === state.noteId);
    if (note) return { type: "note", id: note.id, title: note.title, detail: snippet(note.body) };
  }
  if (state.view === "docs" && state.docId) {
    const doc = d.docs.find(item => item.id === state.docId);
    if (doc) return { type: "doc", id: doc.id, title: doc.title, detail: snippet(doc.body) };
  }
  return null;
}

function aeroContextPack(surfaceOverride, query) {
  if (!window.AeroCore) return { id: "context-unavailable", surface: "aero", sources: [], memories: [], provenanceCoverage: 0 };
  const surface = surfaceOverride || (state.view === "sol" ? state.aeroSourceView : topSectionOf(state.view));
  const pack = AeroCore.contextPack({
    lyfe: state.data,
    aero: state.data.aero,
    connect: readConnectState() || {},
    connectSuite: readConnectSuiteState() || {},
    gmail: gmailMessages,
    knowledge: window.AeroKnowledge ? AeroKnowledge.context(query || "", 6) : [],
    surface,
    activeObject: state.view === "sol" ? state.aeroObject : aeroActiveObject(),
    sourcePolicy: state.data.settings.aeroSources || {},
  });
  state.data.aero.lastContext = pack;
  return pack;
}

function aeroSourceLabel(id) {
  const labels = { today: "Today", tracking: "Tracking", library: "Library", connect: "Connect", gmail: "Gmail", profile: "Profile", knowledge: "Knowledge vault" };
  return labels[id] || String(id || "Lyfe");
}

function syncProfileToConnect() {
  if (!state.data.settings.connectSync) return;
  try {
    const connect = readConnectState() || {};
    const s = state.data.settings;
    connect.profile = Object.assign({}, connect.profile || {}, {
      name: s.name || "",
      username: s.username || "",
      city: s.city || s.country || "",
      headline: s.headline || "",
      bio: s.bio || "",
      website: s.website || "",
      sparks: Array.isArray(s.profileInterests) ? s.profileInterests.slice(0, 8) : [],
      prompt: s.bio || s.headline || "",
    });
    connect.onboarded = connect.onboarded === true || !!s.name;
    localStorage.setItem("lyfe.connect.preview.v1", JSON.stringify(connect));
    connectUiDigest = connectDigest();
  } catch (e) {
    toast("Profile saved in Lyfe, but Connect could not be updated on this device");
  }
}

function viewProfile() {
  const s = state.data.settings;
  const name = (s.name || "Your name").trim();
  const initials = name === "Your name" ? "LY" : name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
  const interests = Array.isArray(s.profileInterests) ? s.profileInterests : [];
  const connect = connectSummary();
  const stats = [
    [state.data.projects.filter(p => p.status === "active").length, "active projects"],
    [state.data.tasks.filter(t => t.status !== "done").length, "pending"],
    [state.data.education.filter(e => e.status === "in-progress").length, "learning"],
    [(state.data.game && state.data.game.streak) || 0, "day streak"],
  ];

  return pageHead("Profile", `<a class="btn" href="connect.html#profile">Open in Connect ↗</a>`, "you, across Lyfe") + `
    <section class="profile-hero panel">
      <div class="profile-avatar" aria-hidden="true"><span>${esc(initials)}</span></div>
      <div class="profile-identity">
        <span class="eyebrow">LYFE PROFILE</span>
        <h2>${esc(name)}</h2>
        <p>${esc(s.headline || "Add a short line about what you are working toward.")}</p>
        <div class="profile-tags">${interests.length ? interests.map(tag => `<span>${esc(tag)}</span>`).join("") : `<span>add your interests below</span>`}</div>
      </div>
      <div class="profile-stats">${stats.map(([value, label]) => `<div><b>${value}</b><span>${esc(label)}</span></div>`).join("")}</div>
    </section>

    <div class="profile-layout">
      <form class="panel profile-editor" data-form="profile">
        <div class="profile-form-head"><span class="eyebrow">YOUR DETAILS</span><h2>Show people what matters.</h2><p>Connect uses only the fields you approve.</p></div>
        <div class="profile-fields">
          <label><span>Name</span><input name="name" maxlength="60" value="${esc(s.name)}" autocomplete="name" placeholder="Your name"></label>
          <label><span>Username</span><input name="username" maxlength="32" value="${esc(s.username)}" placeholder="yourname" autocomplete="username"></label>
          <label class="profile-field-wide"><span>Headline</span><input name="headline" maxlength="100" value="${esc(s.headline)}" placeholder="What are you building, learning, or helping with?"></label>
          <label><span>City or time zone</span><input name="city" maxlength="70" value="${esc(s.city)}" placeholder="Bengaluru · UTC+5:30"></label>
          <label><span>Country</span><input name="country" maxlength="70" value="${esc(s.country)}" autocomplete="country-name" placeholder="India"></label>
          <label class="profile-field-wide"><span>Website</span><input name="website" maxlength="200" value="${esc(s.website)}" inputmode="url" placeholder="https://example.com"></label>
          <label class="profile-field-wide"><span>About you</span><textarea name="bio" rows="5" maxlength="500" placeholder="Write like a person. Share what you care about, what you are working on, and where someone could help.">${esc(s.bio)}</textarea></label>
          <label class="profile-field-wide"><span>Interests, separated by commas</span><input name="interests" maxlength="240" value="${esc(interests.join(", "))}" placeholder="Design, research, open source"></label>
        </div>
        <label class="profile-sync"><input type="checkbox" name="connectSync" value="yes" ${s.connectSync ? "checked" : ""}><span><b>Use in Lyfe Connect</b><small>Private Lyfe data stays separate.</small></span></label>
        <div class="profile-form-actions"><span>Private by default.</span><button class="btn btn-primary" type="submit">Save profile</button></div>
      </form>

      <aside class="panel profile-connect-card">
        <img src="../assets/lyfe_connect_logo.svg" alt="">
        <span class="eyebrow">LYFE CONNECT</span>
        <h2>One profile. Clear boundaries.</h2>
        <p>Your public identity can travel. Your private workspace does not.</p>
        <div class="profile-connect-stats"><span><b>${connect.saved}</b> saved people</span><span><b>${connect.threads}</b> private drafts</span></div>
        <a class="btn" href="connect.html#profile">Review in Connect ↗</a>
      </aside>
    </div>`;
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
      `<button class="filter-chip ${state.taskStatusFilter === v ? "active" : ""}" data-action="task-status" data-v="${v}" aria-pressed="${state.taskStatusFilter === v}">${l}</button>`
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
          <button class="icon-btn" data-action="edit-project" data-id="${esc(p.id)}" title="Edit" aria-label="Edit project: ${esc(p.name)}">✎</button>
          <button class="icon-btn" data-action="delete-project" data-id="${esc(p.id)}" title="Delete" aria-label="Delete project: ${esc(p.name)}">✕</button>
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
          <button class="icon-btn" data-action="edit-goal" data-id="${esc(g.id)}" title="Edit" aria-label="Edit goal: ${esc(g.title)}">✎</button>
          <button class="icon-btn" data-action="delete-goal" data-id="${esc(g.id)}" title="Delete" aria-label="Delete goal: ${esc(g.title)}">✕</button>
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
            aria-label="${m.done ? "Mark milestone as open" : "Mark milestone as done"}: ${esc(m.text)}">${m.done ? "✓" : ""}</button>
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
    <button class="filter-chip ${state.eduFilter === "all" ? "active" : ""}" data-action="edu-filter" data-v="all" aria-pressed="${state.eduFilter === "all"}">All</button>
    ${EDU_STATUSES.map(([v, l]) =>
      `<button class="filter-chip ${state.eduFilter === v ? "active" : ""}" data-action="edu-filter" data-v="${v}" aria-pressed="${state.eduFilter === v}">${l}</button>`
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
        <button class="icon-btn" data-action="edit-edu" data-id="${esc(e.id)}" title="Edit" aria-label="Edit learning entry: ${esc(e.title)}">✎</button>
        <button class="icon-btn" data-action="delete-edu" data-id="${esc(e.id)}" title="Delete" aria-label="Delete learning entry: ${esc(e.title)}">✕</button>
      </span>
    </div>`).join("");

  return pageHead("Learning", `<button class="btn btn-primary" data-action="new-edu">New entry</button>`, "courses, books, skills, and formal study")
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
        <textarea name="text" placeholder="What changed?" required></textarea>
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
            <button class="icon-btn" data-action="delete-log" data-id="${esc(e.id)}" title="Delete" aria-label="Delete work log entry">✕</button>
          </span>
        </div>`).join("")}
    </div>`;
  }).join("");

  return pageHead("Work Log")
    + form
    + (dates.length ? days : emptyState("No work logged yet. Tell Aero what you did."));
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
    <li class="pad-row ${n.id === state[cfg.sel] ? "active" : ""}" role="button" tabindex="0" aria-pressed="${n.id === state[cfg.sel]}" aria-label="Open ${cfg.noun}: ${esc((n.title || "").trim() || "Untitled")}" data-action="select-pad" data-kind="${kind}" data-id="${esc(n.id)}" data-pad-row="${esc(n.id)}">
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
         <button class="pad-thumb add" data-action="pad-add-img" data-kind="${kind}" title="Add photos" aria-label="Add photos">${icon("photo")}</button>
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
  const root = document.getElementById("modal-root");
  modalReturnFocus = document.activeElement;
  root.innerHTML =
    `<div class="overlay lightbox" data-action="overlay-close">
      <figure class="lightbox-body" role="dialog" aria-modal="true" aria-label="Attached photo">
        <img src="${im.data}" alt="attached photo">
        <figcaption>
          <button class="btn btn-sm" data-action="modal-close">Close</button>
          <button class="btn btn-sm btn-danger" data-action="delete-img" data-kind="${kind}" data-id="${esc(itemId)}" data-img="${esc(imgId)}">Delete</button>
        </figcaption>
      </figure>
    </div>`;
  activateDialog(root);
}

async function addAeroImages(fileList) {
  const room = Math.max(0, 3 - aeroDraftImages.length);
  const files = Array.from(fileList || []).filter(file => /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type)).slice(0, room);
  if (!files.length) {
    if (!room) toast("Aero accepts up to three images per turn");
    return;
  }
  for (const file of files) {
    try {
      const image = await shrinkImage(file, 960, .72);
      aeroDraftImages.push({ id: uid(), data: image.data, w: image.w, h: image.h, name: String(file.name || "image").slice(0, 120) });
    } catch (error) {
      toast("One image could not be read");
    }
  }
  if (state.view === "sol") render();
}

function openAeroImage(messageId, imageId) {
  const message = state.data.chat.find(item => item.id === messageId);
  const image = message && (message.attachments || []).find(item => item.id === imageId);
  if (!image) return;
  const root = document.getElementById("modal-root");
  modalReturnFocus = document.activeElement;
  root.innerHTML = `<div class="overlay lightbox" data-action="overlay-close"><figure class="lightbox-body" role="dialog" aria-modal="true" aria-label="Aero image"><img src="${image.data}" alt="${esc(image.name || "Attached image")}"><figcaption><span>${esc(image.name || "Image")}</span><button class="btn btn-sm" data-action="modal-close">Close</button></figcaption></figure></div>`;
  activateDialog(root);
}

function stopAeroVoice() {
  if (aeroRecognition) {
    try { aeroRecognition.stop(); } catch (error) { /* already stopped */ }
  }
  aeroRecognition = null;
  aeroListening = false;
  const button = document.querySelector('[data-action="aero-voice"]');
  if (button) {
    button.classList.remove("active");
    button.setAttribute("aria-label", "Talk to Aero");
    button.title = "Talk to Aero";
  }
}

function toggleAeroVoice() {
  if (aeroListening) { stopAeroVoice(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("Voice input is not available in this browser");
    return;
  }
  const input = document.getElementById("sol-input");
  const baseText = input ? input.value.trim() : "";
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  aeroRecognition = recognition;
  aeroListening = true;
  const button = document.querySelector('[data-action="aero-voice"]');
  if (button) {
    button.classList.add("active");
    button.setAttribute("aria-label", "Stop listening");
    button.title = "Stop listening";
  }
  recognition.onresult = event => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    if (input) input.value = [baseText, transcript.trim()].filter(Boolean).join(baseText ? " " : "");
  };
  recognition.onerror = () => { stopAeroVoice(); toast("Voice input stopped"); };
  recognition.onend = stopAeroVoice;
  try { recognition.start(); } catch (error) { stopAeroVoice(); toast("Voice input could not start"); }
}

function speakAeroMessage(messageId) {
  const message = state.data.chat.find(item => item.id === messageId && item.role === "sol");
  if (!message || !("speechSynthesis" in window)) {
    toast("Read aloud is not available in this browser");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(message.text || ""));
  utterance.lang = navigator.language || "en-US";
  speechSynthesis.speak(utterance);
}

/* ---------------- view: Aero (legacy route id remains sol for old links) ---------------- */

function bubbleHtml(m) {
  const proposal = m.proposal && Array.isArray(m.proposal.actions) ? m.proposal : null;
  const actionCount = proposal ? proposal.actions.length : 0;
  const proposalState = proposal && proposal.status === "applied" ? "Applied"
    : proposal && proposal.status === "failed" ? "Needs attention"
    : "Not applied";
  const proposalHtml = proposal ? `<div class="aero-proposal ${esc(proposal.status || "pending")}">
    <div class="aero-proposal-copy"><span class="aero-proposal-kicker">AERO PLAN</span><b>${esc(AeroCore.actionSummary(proposal.actions))}</b></div>
    <footer><strong>${actionCount} ${actionCount === 1 ? "change" : "changes"}</strong>${proposal.status === "pending" ? `<button class="btn btn-primary btn-sm" type="button" data-action="aero-review-proposal" data-id="${esc(m.id)}">Review plan</button>` : `<span class="aero-proposal-state">${proposalState}</span>`}</footer>
  </div>` : "";
  const feedback = m.role === "sol" && m.episodeId ? (m.feedback
    ? `<div class="aero-feedback is-rated"><span>${m.feedback === "helpful" ? "Marked helpful" : "Marked as a miss"}</span></div>`
    : `<div class="aero-feedback" role="group" aria-label="Rate Aero's first response"><span>Did Aero get it?</span><button type="button" data-action="aero-feedback" data-id="${esc(m.episodeId)}" data-outcome="helpful">Yes</button><button type="button" data-action="aero-feedback" data-id="${esc(m.episodeId)}" data-outcome="missed">Not quite</button></div>`) : "";
  const routeReceipt = m.role === "sol" && m.route && m.route.engine
    ? `<div class="aero-route-receipt"><span>${esc(m.route.engine)}</span><b>${esc(m.route.reason || "local route")}</b>${m.route.steps > 1 ? `<small>${m.route.steps} steps</small>` : ""}</div>` : "";
  const attachments = Array.isArray(m.attachments) && m.attachments.length
    ? `<div class="aero-message-images">${m.attachments.map(image => `<button type="button" data-action="aero-open-image" data-id="${esc(m.id)}" data-img="${esc(image.id)}" aria-label="Open attached image"><img src="${image.data}" alt="${esc(image.name || "Attached image")}"></button>`).join("")}</div>`
    : "";
  const messageTools = m.role === "sol"
    ? `<div class="aero-message-tools"><button type="button" data-action="aero-listen" data-id="${esc(m.id)}" aria-label="Listen to this reply">Listen</button></div>`
    : "";
  return `<div class="msg ${m.role === "user" ? "user" : "sol"}">
    ${m.role === "sol" ? SOL_AVATAR : ""}
    <div class="bubble">${attachments}<span class="aero-message-text">${esc(m.text)}</span>${routeReceipt}${proposalHtml}${feedback}${messageTools}</div>
    <span class="msg-time">${esc(clock(m.ts))}</span>
  </div>`;
}

const SOL_CHIPS = [
  ["what actually matters?", true],
  ["what changed?", true],
  ["same as last time", true],
  ["follow up with ", false],
  ["remember that ", false],
];

function viewSol() {
  const s = state.data.settings;
  const provider = ["auto", "ollama", "groq", "offline"].includes(s.provider) ? s.provider : "auto";
  const routeStatusHtml =
    provider === "auto" ? `<span class="on">◇</span> local first${s.aeroCloudEnabled ? " + Groq" : ""}`
    : provider === "ollama" ? `<span class="on">◇</span> local ${esc(s.ollamaModel || "qwen3:8b")}`
    : provider === "groq" ? `<span class="on">◇</span> Groq for cloud-safe prompts`
    : `○ built-in tools`;
  const statusHtml = aeroMemoryAuthorityError
    ? `<span aria-hidden="true">!</span> private memory paused`
    : routeStatusHtml;
  const activeThread = activeAeroThread();
  const messages = activeAeroMessages();
  const log = messages.map(bubbleHtml).join("");
  const recentThreads = state.data.aeroThreads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 14);
  const activeProjects = state.data.projects.filter(project => project.status === "active").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const threadProject = activeThread && activeThread.projectId ? state.data.projects.find(project => project.id === activeThread.projectId) : null;
  const projectOptions = `<option value="">General</option>${state.data.projects.map(project => `<option value="${esc(project.id)}" ${threadProject && threadProject.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`).join("")}`;
  const draftImages = aeroDraftImages.length ? `<div class="aero-draft-images">${aeroDraftImages.map(image => `<span><img src="${image.data}" alt="${esc(image.name)}"><button type="button" data-action="aero-remove-draft-image" data-id="${esc(image.id)}" aria-label="Remove ${esc(image.name)}">×</button></span>`).join("")}</div>` : "";
  const context = aeroContextPack();
  const metrics = AeroCore.metrics(state.data.aero);
  const sourceCards = context.sources.map(source => `<article class="aero-source-card"><span>${esc(source.label)}</span><p>${esc(source.detail)}</p></article>`).join("");
  const allMemories = AeroCore.normalize(state.data.aero).memories.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const memories = allMemories.length ? allMemories.map(memory => {
    const source = memory.sourceMode === "explicit"
      ? "Taught by you"
      : Math.round(memory.confidence * 100) + "% confidence · " + (memory.successCount || 0) + " successful signal" + ((memory.successCount || 0) === 1 ? "" : "s");
    const lineage = memory.status === "superseded" ? " · replaced by a newer memory"
      : memory.status === "invalidated" ? " · dependency changed"
      : "";
    return `<li class="is-${esc(memory.status)}"><span>${esc(memory.type)} · ${esc(memory.status)} · r${Math.max(0, Number(memory.revision || 0))}</span><p>${esc(memory.claim)}</p><small>${esc(source + lineage)}</small><button type="button" data-action="aero-forget" data-id="${esc(memory.id)}" aria-label="Forget this memory">Forget</button></li>`;
  }).join("") : `<li class="aero-memory-empty"><p>Aero is not carrying anything yet.</p></li>`;
  const pairedSamples = Number(metrics.pairedSamples || metrics.compressionSamples || 0);
  const matchedWords = pairedSamples
    ? `${Number(metrics.baselineWords || metrics.coldBaseline || 0).toFixed(1)} → ${Number(metrics.currentWords || 0).toFixed(1)}`
    : "&mdash;";
  const matchedAccuracy = pairedSamples && metrics.baselineFirstPassRate != null && metrics.repeatFirstPassRate != null
    ? `${Math.round(metrics.baselineFirstPassRate * 100)}% → ${Math.round(metrics.repeatFirstPassRate * 100)}%`
    : "&mdash;";
  const compression = pairedSamples && metrics.compression != null ? Math.round(metrics.compression * 100) : null;
  const accuracyDelta = pairedSamples && metrics.intentAccuracyDelta != null ? Math.round(metrics.intentAccuracyDelta * 100) : null;
  const staleMemoryCount = (metrics.disputedMemories || 0) + (metrics.invalidatedMemories || 0);
  const memoryCount = metrics.activeMemories + " kept"
    + (metrics.candidateMemories ? " · " + metrics.candidateMemories + " candidate" + (metrics.candidateMemories === 1 ? "" : "s") : "")
    + (staleMemoryCount ? " · " + staleMemoryCount + " held back" : "");
  const proofLabel = metrics.proofReady ? "working" : "learning your baseline";
  const proofSummary = metrics.proofReady
    ? `${compression}% less explaining with first-pass accuracy held (${accuracyDelta >= 0 ? "+" : ""}${accuracyDelta} points).`
    : pairedSamples
      ? `${pairedSamples} matched rated repeat${pairedSamples === 1 ? "" : "s"}; every miss stays in the comparison.`
      : "Rate repeated workflows to establish a matched baseline.";
  const notificationCount = aeroUnreadNotificationCount();
  return `<header class="aero-head">
      <div class="aero-title-lockup"><img src="../assets/aero_logo.svg" alt=""><div><span class="eyebrow">AERO</span><h1>Ready when you are.</h1><p>Your work and context, shaped into a clear next move.</p></div></div>
      <div class="aero-head-actions"><span class="sol-status">${statusHtml}</span><button class="aero-attention-button" type="button" data-action="aero-notifications">Updates${notificationCount ? `<span>${notificationCount}</span>` : ""}</button><button class="linklike" data-action="settings">Settings</button></div>
    </header>
    <div class="aero-workspace">
      <aside class="aero-sidebar panel" aria-label="Aero conversations and projects">
        <button class="btn btn-primary aero-new-chat" type="button" data-action="aero-new-thread">+ New conversation</button>
        <section><span class="eyebrow">PROJECTS</span><div class="aero-sidebar-list">${activeProjects.length ? activeProjects.slice(0, 8).map(project => `<button type="button" data-action="aero-open-project" data-id="${esc(project.id)}"><span>${esc(project.name)}</span><small>${Math.max(0, Math.min(100, Number(project.progress || 0)))}%</small></button>`).join("") : `<p>No active projects yet.</p>`}</div></section>
        <section><span class="eyebrow">RECENT</span><div class="aero-sidebar-list aero-thread-list">${recentThreads.map(thread => `<button type="button" class="${activeThread && thread.id === activeThread.id ? "active" : ""}" data-action="aero-open-thread" data-id="${esc(thread.id)}"><span>${esc(thread.title || "New conversation")}</span><small>${esc(timeAgo(thread.updatedAt))}</small></button>`).join("")}</div></section>
        <button class="linklike aero-library-link" type="button" data-action="nav" data-view="aero-work">Open Aero work →</button>
      </aside>
      <section class="aero-conversation panel">
        <div class="aero-conversation-context"><span>Context</span><b>${esc(aeroSourceLabel(context.surface))}</b><label>Project <select id="aero-project-select" aria-label="Link this conversation to a project">${projectOptions}</select></label><button class="linklike" type="button" data-action="aero-context">Inspect</button><button class="linklike" type="button" data-action="sol-clear">Clear</button></div>
        <div class="aero-thread-title"><strong>${esc(activeThread ? activeThread.title : "New conversation")}</strong><small>${threadProject ? esc(threadProject.name) : "General workspace"} · saved automatically</small></div>
        <div id="chat-log">${log || `<div class="aero-empty"><img src="../assets/aero_logo.svg" alt=""><h2>What are we moving?</h2><p>Name the outcome. Aero will gather what matters and show every change before it happens.</p></div>`}</div>
        <div class="sol-chips">${SOL_CHIPS.map(([c, send]) =>
          `<button class="chip" data-action="sol-chip" data-send="${send ? 1 : 0}" data-t="${esc(c)}">${esc(c.trim())}</button>`).join("")}
        </div>
        ${draftImages}
        <form class="composer aero-composer" data-form="sol">
          <button class="aero-composer-tool" type="button" data-action="aero-add-image" aria-label="Attach images" title="Attach images">＋</button>
          <button class="aero-composer-tool ${aeroListening ? "active" : ""}" type="button" data-action="aero-voice" aria-label="${aeroListening ? "Stop listening" : "Talk to Aero"}" title="${aeroListening ? "Stop listening" : "Talk to Aero"}">●</button>
          <textarea id="sol-input" maxlength="4000" rows="1" placeholder="Message Aero…" autocomplete="off" aria-label="Message Aero"></textarea>
          <button class="btn btn-primary" type="submit">Send</button>
          <input type="file" id="aero-image-input" accept="image/jpeg,image/png,image/webp" multiple hidden>
        </form>
        <p class="aero-composer-note">Nothing changes without your review. Images use only this message on the protected route.</p>
      </section>
      <details class="aero-inspector">
        <summary><span><b>Context, memory and learning</b><small>${context.sources.length} sources · ${memoryCount} · ${proofLabel}</small></span><span>Inspect</span></summary>
        <aside class="aero-rail">
          <section class="aero-rail-card"><header><span class="eyebrow">AVAILABLE CONTEXT</span><b>${Math.round(context.provenanceCoverage * 100)}% ready</b></header><div class="aero-source-grid">${sourceCards || `<p>No sources are enabled.</p>`}</div><button class="linklike" type="button" data-action="settings">Choose sources →</button></section>
          <section class="aero-rail-card"><header><span class="eyebrow">WHAT AERO KNOWS</span><b>${memoryCount}</b></header><ul class="aero-memory-list">${memories}</ul><button class="linklike" type="button" data-action="aero-teach">Teach Aero →</button></section>
          <section class="aero-rail-card aero-proof"><header><span class="eyebrow">GETTING EASIER</span><b>${proofLabel}</b></header><div class="aero-proof-grid"><div><strong>${metrics.scored}</strong><span>rated results</span></div><div><strong>${pairedSamples}</strong><span>matched repeats</span></div><div><strong>${matchedWords}</strong><span>words · first → repeat</span></div><div><strong>${matchedAccuracy}</strong><span>right first time</span></div></div><p>${esc(proofSummary)}</p></section>
        </aside>
      </details>
    </div>`;
}

function scrollChat() {
  const log = document.getElementById("chat-log");
  if (log) log.scrollTop = log.scrollHeight;
}

function pushChat(role, text, meta) {
  let thread = activeAeroThread();
  if (!thread) thread = createAeroThread(null, "New conversation");
  const m = Object.assign({ id: uid(), threadId: thread.id, role, text, ts: Date.now() }, meta || {});
  state.data.chat.push(m);
  if (state.data.chat.length > 500) state.data.chat = state.data.chat.slice(-500);
  thread.updatedAt = m.ts;
  if (role === "user" && (!thread.title || thread.title === "New conversation" || thread.title === "Image conversation")) {
    thread.title = titleFromAeroPrompt(text);
    const title = document.querySelector(".aero-thread-title strong");
    if (title) title.textContent = thread.title;
    const activeRow = document.querySelector(".aero-thread-list button.active span");
    if (activeRow) activeRow.textContent = thread.title;
  }
  save();
  if (state.view === "sol" && thread.id === state.data.aeroActiveThreadId) {
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

async function solSay(bubbles, meta) {
  const clean = (Array.isArray(bubbles) ? bubbles : [bubbles]).map(item => String(item || "").trim()).filter(Boolean);
  // Aero speaks in one or two deliberate messages. If a model returns more,
  // keep the first beat and fold the rest into one useful continuation.
  const deliberate = clean.length > 2 ? [clean[0], clean.slice(1).join("\n\n")] : clean;
  for (let index = 0; index < deliberate.length; index++) {
    const raw = deliberate[index];
    // sol never uses em dashes, whatever brain produced the text
    const text = String(raw).replace(/\s*[—–]\s*/g, ", ");
    showTyping();
    await sleep(Math.min(420 + text.length * 14, 1500));
    hideTyping();
    const bubbleMeta = Object.assign({}, meta || {});
    if (index !== deliberate.length - 1) {
      delete bubbleMeta.proposal;
      delete bubbleMeta.episodeId;
    }
    pushChat("sol", text, bubbleMeta);
  }
}

function aeroServerKind(actions) {
  if (!(CLOUD_MODE && window.LyfeCloud) || !Array.isArray(actions) || !actions.length) return "";
  if (LyfeCloud.aeroExecutionEnabled && actions.every(action => action && AERO_SERVER_ACTIONS.has(action.type))) return "lyfe";
  if (LyfeCloud.aeroMemoryEnabled && actions.every(action => action && AERO_MEMORY_ACTIONS.has(action.type))) return "memory";
  if (LyfeCloud.aeroMemoryEnabled && actions.some(action => action && AERO_MEMORY_ACTIONS.has(action.type))) return "mixed";
  return "";
}

function aeroServerEligible(actions) {
  return ["lyfe", "memory"].includes(aeroServerKind(actions));
}

function aeroMemoryOperations(actions) {
  return (actions || []).map(candidate => window.AeroCore ? AeroCore.validateAction(candidate) : candidate).filter(Boolean).map(action => {
    if (action.type === "memory_forget") return { type: "forget", query: action.query || action.claim };
    return {
      type: "remember",
      claim: action.claim,
      memoryType: action.memoryType || "semantic",
      scope: action.scope || "global",
      memoryKey: action.memoryKey || "",
      dependsOn: Array.isArray(action.dependsOn) ? action.dependsOn : [],
      supersedes: Array.isArray(action.supersedes) ? action.supersedes : [],
    };
  });
}

function aeroLocalReviewProposalModal(message) {
  if (!message || !message.proposal || !Array.isArray(message.proposal.actions)) return;
  const proposal = message.proposal;
  const count = proposal.actions.length;
  const run = proposal.runId && window.AeroHarness ? state.data.aeroRuns.find(item => item.id === proposal.runId) : null;
  const runCopy = run ? `<div class="aero-review-runtime"><span>Bounded local run</span><b>${run.steps.length} step${run.steps.length === 1 ? "" : "s"}</b><b>0 cloud calls</b><b>Approval required</b></div>` : "";
  openModal(
    `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>${esc(AeroCore.actionSummary(proposal.actions))}</h3></div>
     ${runCopy}
     <div class="aero-review-list">${proposal.actions.map((action, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(aeroActionDetail(action))}</p></article>`).join("")}</div>
     <div class="aero-review-footer"><strong>${count} ${count === 1 ? "change" : "changes"}</strong><div><button type="button" class="btn" data-action="aero-cancel" data-id="${esc(message.id)}">Not now</button><button type="button" class="btn btn-primary" data-action="aero-apply" data-id="${esc(message.id)}">Apply changes</button></div></div>`,
    "aero-review-modal"
  );
}

function aeroServerReviewHtml(message, prepared, kind) {
  const review = Array.isArray(prepared.review) ? prepared.review : [];
  const count = review.length;
  const memory = kind === "memory";
  const presence = prepared.presenceRequired === true;
  return `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>${esc(AeroCore.actionSummary(message.proposal.actions))}</h3></div>
    <div class="aero-review-runtime"><span>${memory ? "Private memory transaction" : "Atomic account run"}</span><b>${count} step${count === 1 ? "" : "s"}</b><b>${memory ? "Authoritative state" : "1 database commit"}</b><b>${presence ? "Device verification" : "Exact approval"}</b></div>
    <div class="aero-review-list">${review.map((step, index) => {
      const detail = step.type === "memory_upsert" ? aeroActionDetail({ type: step.type, claim: step.subject })
        : step.type === "memory_forget" ? aeroActionDetail({ type: step.type, query: step.subject })
          : step.subject || "Bound change";
      return `<article><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(detail)}<small>${esc(step.acceptance || "One matching Lyfe record exists.")}</small></p></article>`;
    }).join("")}</div>
    <div class="aero-review-footer"><strong>${count} ${count === 1 ? "change" : "changes"}, all or nothing</strong><div><button type="button" class="btn" data-action="aero-cancel" data-id="${esc(message.id)}">Not now</button><button type="button" class="btn btn-primary" data-action="aero-apply" data-id="${esc(message.id)}">${presence ? "Verify & apply" : "Apply exact plan"}</button></div></div>`;
}

async function aeroReviewProposalModal(message) {
  if (!message || !message.proposal || !Array.isArray(message.proposal.actions)) return;
  const serverKind = aeroServerKind(message.proposal.actions);
  if (!serverKind) {
    aeroLocalReviewProposalModal(message);
    return;
  }
  if (serverKind === "mixed") {
    openModal(
      `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>Split this into two plans</h3></div>
       <p class="settings-data-note">Memory and workspace records use separate private ledgers. Aero will not pretend they are one atomic change.</p>
       <div class="aero-review-footer"><strong>Nothing changed</strong><button type="button" class="btn" data-action="modal-close">Close</button></div>`,
      "aero-review-modal"
    );
    return;
  }
  openModal(
    `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>Securing this plan</h3></div>
     <div class="aero-review-runtime"><span>Checking the current ${serverKind === "memory" ? "memory" : "Lyfe"} revision</span><b>Binding exact changes</b><b>No change yet</b></div>
     <div class="aero-review-footer"><strong>Preparing review</strong><button type="button" class="btn" data-action="modal-close">Close</button></div>`,
    "aero-review-modal"
  );
  try {
    let prepared;
    if (serverKind === "memory") {
      const memoryRevision = Number(state.data.aero && state.data.aero.memoryRevision || 0);
      prepared = await LyfeCloud.prepareAeroMemory({
        requestKey: (`aero-memory-${message.id}-r${memoryRevision}`).slice(0, 160),
        operations: aeroMemoryOperations(message.proposal.actions),
      });
    } else {
      const flushed = await LyfeCloud.flush(state.data, state.data.rev);
      if (flushed === false) throw Object.assign(new Error("Lyfe changed in another signed-in session. Open the plan again."), { code: "state_changed" });
      const requestKey = (`aero-${message.id}-r${state.data.rev}`).slice(0, 160);
      const messageIndex = state.data.chat.findIndex(item => item.id === message.id);
      const userIntent = state.data.chat.slice(0, messageIndex).reverse().find(item => item.role === "user");
      prepared = await LyfeCloud.prepareAeroRun({
        requestKey,
        intent: String(userIntent && userIntent.text || "Apply this Aero plan").slice(0, 1_000),
        actions: message.proposal.actions,
      });
    }
    const current = state.data.chat.find(item => item.id === message.id);
    if (serverKind === "memory" && prepared && prepared.status === "noop") {
      if (prepared.state) state.data.aero = AeroCore.normalize(prepared.state);
      if (current && current.proposal) {
        current.proposal.status = "applied";
        current.proposal.execution = "server-memory-noop";
      }
      closeModal();
      save(false, true);
      render();
      toast("Aero already holds that memory");
      return;
    }
    if (!current || !current.proposal || current.proposal.status !== "pending") {
      if (prepared && prepared.contractDigest) {
        if (serverKind === "memory" && prepared.transactionId) {
          LyfeCloud.cancelAeroMemory({ transactionId: prepared.transactionId, contractDigest: prepared.contractDigest }).catch(() => {});
        } else if (prepared.runId) {
          LyfeCloud.cancelAeroRun({ runId: prepared.runId, contractDigest: prepared.contractDigest }).catch(() => {});
        }
      }
      closeModal();
      return;
    }
    aeroServerAuthority.set(message.id, {
      kind: serverKind,
      runId: prepared.runId,
      transactionId: prepared.transactionId,
      contractDigest: prepared.contractDigest,
      approvalToken: prepared.approvalToken,
      approvalExpiresAt: prepared.approvalExpiresAt,
      presenceRequired: prepared.presenceRequired === true,
      baseRev: prepared.baseRev,
      baseRevision: prepared.baseRevision,
    });
    openModal(aeroServerReviewHtml(current, prepared, serverKind), "aero-review-modal");
  } catch (error) {
    const copy = error && error.message ? error.message : "The protected review route is unavailable.";
    openModal(
      `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>Nothing changed</h3></div>
       <p class="settings-data-note">${esc(copy)}</p>
       <div class="aero-review-footer"><strong>Stopped safely</strong><button type="button" class="btn" data-action="modal-close">Close</button></div>`,
      "aero-review-modal"
    );
  }
}

async function applyServerAeroProposal(messageId) {
  const binding = aeroServerAuthority.get(messageId);
  const message = state.data.chat.find(item => item.id === messageId);
  if (!message || !message.proposal || message.proposal.status !== "pending") return;
  if (!binding || !binding.approvalToken) {
    await aeroReviewProposalModal(message);
    return;
  }
  const applyButton = Array.from(document.querySelectorAll('[data-action="aero-apply"]'))
    .find(button => button.dataset.id === messageId);
  if (applyButton) { applyButton.disabled = true; applyButton.textContent = binding.presenceRequired ? "Verify on this device…" : "Applying exact plan…"; }
  try {
    let presenceToken = "";
    if (binding.presenceRequired) {
      const presence = await LyfeCloud.approveAeroPresence({
        targetType: binding.kind === "memory" ? "memory" : "run",
        targetId: binding.kind === "memory" ? binding.transactionId : binding.runId,
        contractDigest: binding.contractDigest,
        approvalToken: binding.approvalToken,
      });
      presenceToken = String(presence && presence.presenceToken || "");
      if (!presenceToken) throw Object.assign(new Error("Your device did not return an approval for this exact plan."), { code: "presence_invalid" });
      if (applyButton) applyButton.textContent = "Applying verified plan…";
    }
    if (binding.kind === "memory") {
      const episodeEvidence = AeroCore.normalize(state.data.aero).episodes.find(item => item.id === message.episodeId);
      const result = await LyfeCloud.commitAeroMemory({
        transactionId: binding.transactionId,
        contractDigest: binding.contractDigest,
        approvalToken: binding.approvalToken,
        presenceToken,
      });
      aeroServerAuthority.delete(messageId);
      state.data.aero = AeroCore.normalize(result.state);
      const current = state.data.chat.find(item => item.id === messageId);
      const actionCount = current && current.proposal ? current.proposal.actions.length : message.proposal.actions.length;
      if (current && current.proposal) {
        current.proposal.status = "applied";
        current.proposal.execution = "server-memory-atomic";
        current.proposal.receipt = {
          transactionId: binding.transactionId,
          digest: result.certificate && result.certificate.digest || "",
          atomic: true,
          presenceVerified: !!(result.certificate && result.certificate.payload && result.certificate.payload.presence && result.certificate.payload.presence.verified),
        };
        if (current.episodeId) {
          observeAeroOutcome(current.episodeId, "accepted", {
            actionCount,
            actionTypes: current.proposal.actions.map(action => action.type),
            execution: "server-memory-atomic",
          }, episodeEvidence);
        }
      }
      closeModal();
      save(false, true);
      render();
      toast(actionCount + " private memory change" + (actionCount === 1 ? " committed" : "s committed atomically"));
      return;
    }
    const result = await LyfeCloud.commitAeroRun({
      runId: binding.runId,
      contractDigest: binding.contractDigest,
      approvalToken: binding.approvalToken,
      presenceToken,
    });
    aeroServerAuthority.delete(messageId);
    state.data = normalize(result.state);
    state.data.rev = Number(result.rev || state.data.rev || 0);
    state.cloudRev = Number(result.rev || state.cloudRev || 0);
    const current = state.data.chat.find(item => item.id === messageId);
    const actionCount = current && current.proposal ? current.proposal.actions.length : message.proposal.actions.length;
    if (current && current.proposal) {
      current.proposal.status = "applied";
      current.proposal.execution = "server-atomic";
      current.proposal.receipt = {
        runId: binding.runId,
        digest: result.certificate && result.certificate.digest || "",
        atomic: true,
        presenceVerified: !!(result.certificate && result.certificate.payload && result.certificate.payload.presence && result.certificate.payload.presence.verified),
      };
      if (current.episodeId) {
        observeAeroOutcome(current.episodeId, "accepted", {
          actionCount,
          actionTypes: current.proposal.actions.map(action => action.type),
          execution: "server-atomic",
        });
      }
    }
    closeModal();
    save(false, false);
    try { await LyfeCloud.flush(state.data, state.data.rev); } catch (_) { /* the completion itself is already durable */ }
    render();
    toast(actionCount + " approved change" + (actionCount === 1 ? " applied atomically" : "s applied atomically"));
  } catch (error) {
    aeroServerAuthority.delete(messageId);
    closeModal();
    if (error && error.code === "state_changed") {
      try {
        const remote = await LyfeCloud.pull();
        if (remote) onCloudRemote(remote, true);
      } catch (_) { /* a later focus or realtime event will recover */ }
    }
    render();
    toast(error && error.message ? error.message : "Aero stopped before changing Lyfe");
  }
}

async function cancelServerAeroProposal(messageId) {
  const binding = aeroServerAuthority.get(messageId);
  const message = state.data.chat.find(item => item.id === messageId);
  if (!message || !message.proposal || message.proposal.status !== "pending") return;
  aeroServerAuthority.delete(messageId);
  if (binding) {
    try {
      if (binding.kind === "memory") {
        await LyfeCloud.cancelAeroMemory({ transactionId: binding.transactionId, contractDigest: binding.contractDigest });
      } else {
        await LyfeCloud.cancelAeroRun({ runId: binding.runId, contractDigest: binding.contractDigest });
      }
    } catch (_) { /* the memory-only authority is gone and expires server-side */ }
  }
  message.proposal.status = "cancelled";
  if (message.episodeId) {
    observeAeroOutcome(message.episodeId, "rejected", {
      actionCount: 0,
      actionTypes: message.proposal.actions.map(action => action.type),
    });
  }
  closeModal();
  save(false, true);
  render();
  toast("No changes made");
}

function observeAeroOutcome(episodeId, outcome, metadata, episodeOverride) {
  if (!episodeId || !window.AeroCore) return;
  const serverOwned = !!(CLOUD_MODE && window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroMemoryEnabled);
  if (!serverOwned) {
    state.data.aero = AeroCore.observeOutcome(state.data.aero, episodeId, outcome, metadata || {});
    return;
  }
  // Signed-in feedback is evidence for the private ledger, not permission for
  // the browser cache to mutate or promote memory while the request is in
  // flight. The authoritative response replaces the cache after commit.
  const episode = episodeOverride || AeroCore.normalize(state.data.aero).episodes.find(item => item.id === episodeId);
  if (!episode) return;
  const evidenceEpisode = Object.assign({}, episode, metadata || {});
  const requestKey = (`aero-observe-${episodeId}-${outcome}`).slice(0, 160);
  LyfeCloud.observeAeroMemory({
    requestKey,
    operations: [{ type: "observe", episode: evidenceEpisode, outcome }],
  }).then(result => {
    if (!(result && result.state)) return;
    state.data.aero = AeroCore.normalize(result.state);
    save(false, true);
    render();
  }).catch(() => {
    // The immediate device feedback remains visible. A later authoritative
    // read replaces it if the private server transaction did not commit.
  });
}

async function commitDirectAeroMemory(operations, requestKey, successMessage) {
  if (!(CLOUD_MODE && window.LyfeCloud && LyfeCloud.aeroMemoryEnabled)) return false;
  openModal(
    `<div class="aero-review-head"><div class="aero-review-brand"><img src="../assets/aero_logo.svg" alt=""><span>AERO</span></div><h3>Applying the private memory change</h3></div>
     <div class="aero-review-runtime"><span>Exact target bound</span><b>One-use approval</b><b>No public data</b></div>`,
    "aero-review-modal"
  );
  try {
    const prepared = await LyfeCloud.prepareAeroMemory({ requestKey: requestKey.slice(0, 160), operations });
    if (prepared.status === "noop") {
      if (prepared.state) state.data.aero = AeroCore.normalize(prepared.state);
      closeModal(); save(false, true); render(); toast(successMessage); return true;
    }
    let presenceToken = "";
    if (prepared.presenceRequired) {
      const presence = await LyfeCloud.approveAeroPresence({
        targetType: "memory",
        targetId: prepared.transactionId,
        contractDigest: prepared.contractDigest,
        approvalToken: prepared.approvalToken,
      });
      presenceToken = String(presence && presence.presenceToken || "");
      if (!presenceToken) throw new Error("Your device did not verify this exact memory change.");
    }
    const result = await LyfeCloud.commitAeroMemory({
      transactionId: prepared.transactionId,
      contractDigest: prepared.contractDigest,
      approvalToken: prepared.approvalToken,
      presenceToken,
    });
    state.data.aero = AeroCore.normalize(result.state);
    closeModal(); save(false, true); render(); toast(successMessage); return true;
  } catch (error) {
    closeModal();
    toast(error && error.message ? error.message : "Aero stopped before changing memory");
    return false;
  }
}

function aeroActionDetail(action) {
  const clean = window.AeroCore ? AeroCore.validateAction(action) : action;
  if (!clean) return "Unsupported change";
  const subject = clean.title || clean.name || clean.claim || clean.query || clean.text || clean.body || "item";
  const labels = {
    add_task: "Create task", complete_task: "Complete task", add_note: "Save note", add_doc: "Create doc",
    log_work: "Log work", add_goal: "Create goal", add_education: "Add learning", add_project: "Create project",
    memory_upsert: "Remember", memory_forget: "Forget",
  };
  return (labels[clean.type] || "Change") + ": " + String(subject).slice(0, 180);
}

/* ----- Aero: applying approved actions to the Lyfe ledger ----- */

function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : null; }

function applyActions(actions) {
  const d = state.data;
  let n = 0;
  for (const candidate of (actions || [])) {
    const a = window.AeroCore ? AeroCore.validateAction(candidate) : candidate;
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
          const matches = d.tasks.filter(x => x.status !== "done" &&
            (x.title.toLowerCase().includes(q) || q.includes(x.title.toLowerCase())));
          if (matches.length === 1) { matches[0].status = "done"; matches[0].completedAt = Date.now(); n++; }
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
          const project = {
            id: uid(), name,
            area: AREAS.includes(a.area) ? a.area : "Work",
            status: "active", progress: 0, targetDate: null,
            description: String(a.description || "").trim(), createdAt: Date.now(),
          };
          d.projects.push(project);
          const thread = activeAeroThread();
          if (thread && !thread.projectId) thread.projectId = project.id;
          n++; break;
        }
        case "memory_upsert": {
          d.aero = AeroCore.upsertMemory(d.aero, {
            type: a.memoryType || "semantic",
            scope: a.scope || "global",
            claim: a.claim,
            memoryKey: a.memoryKey,
            dependsOn: a.dependsOn,
            supersedes: a.supersedes,
            sourceMode: "explicit",
            status: "active",
            confidence: 1,
            evidence: ["Taught directly in Aero"],
            sourceRefs: [{ kind: "user-explicit", id: "approved-aero-action", label: "Approved in Aero", at: Date.now() }],
          });
          n++; break;
        }
        case "memory_forget": {
          const before = d.aero.memories.length;
          d.aero = AeroCore.forgetMemory(d.aero, a.query || a.claim);
          if (d.aero.memories.length < before) n++;
          break;
        }
      }
    } catch (e) { /* skip malformed action */ }
  }
  if (n) { save(); renderNav(); }
  return n;
}

function aeroLedgerSnapshot() {
  const d = state.data;
  return {
    tasks: d.tasks.length,
    taskIds: d.tasks.map(task => task.id),
    openTasks: d.tasks.filter(task => task.status !== "done").map(task => task.id),
    notes: d.notes.length,
    noteIds: d.notes.map(note => note.id),
    docs: d.docs.length,
    docIds: d.docs.map(doc => doc.id),
    worklog: d.worklog.length,
    worklogIds: d.worklog.map(entry => entry.id),
    goals: d.goals.length,
    goalIds: d.goals.map(goal => goal.id),
    education: d.education.length,
    educationIds: d.education.map(item => item.id),
    projects: d.projects.length,
    projectIds: d.projects.map(project => project.id),
    memories: d.aero && Array.isArray(d.aero.memories) ? d.aero.memories.length : 0,
    memoryIds: d.aero && Array.isArray(d.aero.memories) ? d.aero.memories.map(memory => memory.id) : [],
  };
}

function aeroRollbackSnapshot() {
  const data = state.data;
  return JSON.parse(JSON.stringify({
    tasks: data.tasks,
    notes: data.notes,
    docs: data.docs,
    worklog: data.worklog,
    goals: data.goals,
    education: data.education,
    projects: data.projects,
    aero: data.aero,
  }));
}

function verifyAeroAction(action, before) {
  const d = state.data;
  const type = action && action.type;
  const exact = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
  const added = (items, ids, predicate) => items.find(item => !ids.includes(item.id) && predicate(item));
  let record = null;
  if (type === "add_task") record = added(d.tasks, before.taskIds, item => exact(item.title, action.title) && item.status === "open");
  if (type === "complete_task") {
    const query = String(action.title || "").trim().toLowerCase();
    record = d.tasks.find(item => before.openTasks.includes(item.id) && item.status === "done"
      && (item.title.toLowerCase().includes(query) || query.includes(item.title.toLowerCase())));
  }
  if (type === "add_note") record = added(d.notes, before.noteIds, item => (!action.title || exact(item.title, action.title)) && (!action.body || exact(item.body, action.body)));
  if (type === "add_doc") record = added(d.docs, before.docIds, item => (!action.title || exact(item.title, action.title)) && (!action.body || exact(item.body, action.body)));
  if (type === "log_work") record = added(d.worklog, before.worklogIds, item => exact(item.text, action.text) && (action.hours == null || Number(item.hours) === Number(action.hours)));
  if (type === "add_goal") record = added(d.goals, before.goalIds, item => exact(item.title, action.title));
  if (type === "add_education") record = added(d.education, before.educationIds, item => exact(item.title, action.title));
  if (type === "add_project") record = added(d.projects, before.projectIds, item => exact(item.name, action.name || action.title));
  if (type === "memory_upsert") record = d.aero.memories.find(item => exact(item.claim, action.claim) && item.status === "active");
  if (type === "memory_forget") {
    const query = String(action.query || action.claim || "").trim().toLowerCase();
    const stillPresent = d.aero.memories.some(item => item.id.toLowerCase() === query || item.claim.toLowerCase().includes(query));
    if (!stillPresent && d.aero.memories.length < before.memories) record = { id: `forgot:${query}` };
  }
  return record ? { verified: true, ref: String(record.id), observation: postconditionForAeroAction(action) } : { verified: false, ref: "", observation: "" };
}

function postconditionForAeroAction(action) {
  if (action && action.type === "complete_task") return "The intended task is marked complete.";
  if (action && action.type === "memory_forget") return "The selected memory is no longer active.";
  if (action && action.type === "log_work") return "One matching work-log entry exists.";
  return "One matching Lyfe record exists.";
}

function applyAeroActionStep(action) {
  const before = aeroLedgerSnapshot();
  const rollback = aeroRollbackSnapshot();
  const applied = applyActions([action]);
  return { applied, before, rollback };
}

function auditAeroActionStep(step, execution) {
  const observation = execution && execution.applied > 0
    ? verifyAeroAction(step.action, execution.before)
    : { verified: false, ref: "", observation: "" };
  return {
    verified: observation.verified,
    integrity: "clean",
    auditor: "lyfe-ledger-readback",
    facts: observation.verified ? [step.acceptance] : [],
    evidence: observation.verified ? [{
      type: "postcondition-readback",
      source: "lyfe-local-ledger",
      ref: observation.ref,
      claim: observation.observation,
      observedAt: Date.now(),
    }] : [],
  };
}

function compensateAeroActionStep(execution) {
  if (!execution || !execution.rollback) return false;
  Object.keys(execution.rollback).forEach(key => { state.data[key] = execution.rollback[key]; });
  save(false, true);
  return true;
}

/* ----- Aero: local deterministic brain ----- */

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
  if (!c.open.length) b.push("Your task list is clear.");
  else {
    let line = `you've got ${c.open.length} open ${c.open.length === 1 ? "task" : "tasks"}`;
    if (c.dueToday.length) line += `, ${c.dueToday.length} due today`;
    if (c.overdue.length) line += `, with ${c.overdue.length} overdue`;
    b.push(line + ".");
  }
  if (c.hours) b.push(`${fmtHours(c.hours)}h logged this week.`);
  else b.push("No work logged this week yet.");
  return b;
}

function dueBubbles() {
  const c = contextBits();
  const items = c.overdue.concat(c.dueToday);
  if (!items.length) return ["Nothing is due today."];
  const list = items.slice(0, 5).map(x => "• " + x.title).join("\n");
  return [`Due now:\n${list}`, items.length > 5 ? `${items.length - 5} more are in Tasks.` : ""].filter(Boolean);
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
  const re = /^(?:(?:hey|hi|hello|yo|ok|okay)[\s,!]+)?(?:(?:aero|eos|sol)[\s,!]+)?(?:(?:please|pls|plz)\s+)?(?:(?:can|could|will|would)\s+(?:you|u)\s+(?:please\s+)?)?(?:(?:please|pls)\s+)?/i;
  const m = s.match(re);
  if (m && m[0].trim()) {
    const rest = s.slice(m[0].length).trim();
    if (rest) return rest;
  }
  return s;
}

const JOKES = [
  "A neuron walks into a bar. It doesn’t fire. Tough crowd.",
  "I only know sundial jokes. They take all day.",
  "My sleep schedule is perfect. I rise at dawn; it’s the job.",
  "I’d tell you a localStorage joke, but you might forget to persist it.",
];

const EMPATHY_1 = ["That sounds like a lot.", "That sounds rough.", "I hear you."];
const EMPATHY_2 = [
  "Want to untangle it, reduce today's list, or just leave it here?",
  "We can choose one small next step, or pause the list.",
  "I can help reduce the load without pretending it fixes everything.",
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

  if (/^(hi+|hii+|hello+|hey+|heyy+|yo+|sup|hola|good (morning|afternoon|evening)|wass?up)(\s+(?:aero|eos|sol))?\b[!.\s]*$/i.test(lowOrig)) {
    const name = (state.data.settings.name || "").trim();
    const c = contextBits();
    const hello = pick([`Hey${name ? " " + name.split(/\s+/)[0] : ""}.`, "Hey.", "Hello."]);
    const follow = c.dueToday.length || c.overdue.length
      ? `${c.dueToday.length + c.overdue.length} item${c.dueToday.length + c.overdue.length === 1 ? "" : "s"} need attention today.`
      : "Nothing is pressing. What should move?";
    return { bubbles: [hello, follow], actions: [] };
  }

  if (/thank|thanks|thx|\bty\b/.test(lowOrig)) {
    return { bubbles: [pick(["Anytime.", "Of course.", "Done."])], actions: [] };
  }

  if (/^(bye|gn|good ?night|see ya|later)\b/.test(lowOrig)) {
    return { bubbles: [pick(["See you later.", "Rest well.", "I'll keep your place."])], actions: [] };
  }

  /* -- commands, on the courtesy-stripped message -- */

  const t = stripCourtesy(orig);
  const low = t.toLowerCase();

  if (/what can you do|^help$|how do (you|i) work/.test(low)) {
    return {
      bubbles: [
        "I work across the Lyfe context you allow: Today, Tracking, Library, Connect, Gmail, and your knowledge vault.",
        "Ask what matters, compare something, plan a follow-up, or tell me what to remember. I preview workspace changes first.",
        "The goal is simple: you should need fewer words over time without losing accuracy.",
      ],
      actions: [],
    };
  }

  if ((m = t.match(/^(?:remember|learn|teach aero)(?: that)?\s*:?[\s]+(.+)/i))) {
    const claim = m[1].trim();
    const memoryType = /\b(?:when|workflow|steps?|process|usually do)\b/i.test(claim) ? "procedural"
      : /\b(?:project|for this|on this)\b/i.test(claim) ? "project" : "semantic";
    return {
      bubbles: ["I can keep that as a " + memoryType + " memory. You can review or forget it anytime."],
      actions: [{ type: "memory_upsert", claim, memoryType, scope: memoryType === "project" ? "current-project" : "global" }],
    };
  }

  if ((m = t.match(/^(?:forget|remove memory)(?: that| about)?\s*:?[\s]+(.+)/i))) {
    return { bubbles: ["I found the memory change. Review it before anything is removed."], actions: [{ type: "memory_forget", query: m[1].trim() }] };
  }

  if (/what (?:have you|did you) learn|what do you remember|show (?:your )?memory/.test(low)) {
    const memories = AeroCore.normalize(state.data.aero).memories.filter(item => item.status === "active" || item.status === "provisional").slice(-6);
    if (!memories.length) return { bubbles: ["I’m not carrying any persistent memory yet."], actions: [] };
    return { bubbles: ["Here’s what I’m carrying:\n" + memories.map(item => "• " + item.claim + " [" + item.type + "]").join("\n")], actions: [] };
  }

  if (/same as last time|use my usual|do it my way/.test(low)) {
    const memory = AeroCore.normalize(state.data.aero).memories.filter(item => item.type === "procedural" && item.status === "active").sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!memory) return { bubbles: ["I don’t have a confirmed procedure for that yet. Show me once, then tell me what should persist."], actions: [] };
    return { bubbles: ["Your latest confirmed procedure is: \"" + memory.claim + "\". Tell me the outcome and I’ll use it."], actions: [] };
  }

  if (/what changed|catch me up|bring me up to speed/.test(low)) {
    const pack = aeroContextPack();
    const lines = pack.sources.filter(source => source.items.length).slice(0, 4).map(source => "• " + source.label + ": " + source.detail);
    return { bubbles: [lines.length ? "Here’s what changed:\n" + lines.join("\n") : "There isn’t enough enabled context yet. Open Controls to choose what I can use."], actions: [] };
  }

  if (/\b(?:gmail|inbox|email)\b/.test(low) && /\b(?:summary|summarize|what|latest|important|changed)\b/.test(low)) {
    const source = aeroContextPack().sources.find(item => item.id === "gmail");
    if (!source) return { bubbles: [window.LyfeCloud && LyfeCloud.gmailToken ? "Gmail is connected, but recent metadata is not loaded. Open Today, then try again." : "Connect Gmail in Settings, then choose whether Aero may use its metadata and snippets."], actions: [] };
    return { bubbles: [source.items.length ? "From recent inbox metadata:\n" + source.items.slice(0, 5).map(item => "• " + item.title + ", " + item.detail).join("\n") : "There’s nothing recent to flag."], actions: [] };
  }

  if (/\b(?:connect|messages?|people|opportunit)\b/.test(low) && /\b(?:summary|what|latest|changed|follow up)\b/.test(low)) {
    const source = aeroContextPack("connect").sources.find(item => item.id === "connect");
    if (!source || !source.items.length) return { bubbles: ["Connect is enabled, but there isn’t enough recent context to identify a person or thread. Name who you mean."], actions: [] };
    return { bubbles: ["From Connect:\n" + source.items.slice(0, 5).map(item => "• " + item.title + (item.detail ? ", " + item.detail : "")).join("\n")], actions: [] };
  }

  if (/\b(?:library|notes?|docs?|saved)\b/.test(low) && /\b(?:what|summary|summarize|latest|find)\b/.test(low)) {
    const source = aeroContextPack("library").sources.find(item => item.id === "library");
    return { bubbles: [source && source.items.length ? "From your Library:\n" + source.items.slice(0, 6).map(item => "• " + item.title).join("\n") : "Your Library is empty, or its Aero source is off."], actions: [] };
  }

  if (window.AeroKnowledge && AeroKnowledge.stats().records && /\b(?:what|where|when|why|how|find|recall|discuss|said|chatgpt|gemini|history|vault)\b/.test(low)) {
    const hits = AeroKnowledge.context(t, 4);
    if (hits.length) {
      return {
        bubbles: ["I found this in your on-device vault:\n" + hits.map(item => `• ${item.sourceLabel} · ${item.title}\n  ${item.detail}`).join("\n")],
        actions: [],
      };
    }
  }

  if ((m = t.match(/^(?:add (?:a )?task(?: to)?|new task|create (?:a )?task(?: to)?|task|todo|remind me to|i need to|i have to|i gotta|gotta|remember to)\s*:?\s+(.+)/i))) {
    const { title, due } = stripDateWords(m[1]);
    if (!title) return { bubbles: ["What should I remind you to do?"], actions: [] };
    return {
      bubbles: [`Prepared “${title}”${dueWord(due)}.`],
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
        bubbles: [`Prepared completion for “${task.title}”.`],
        actions: [{ type: "complete_task", title: task.title }],
      };
    }
    return { bubbles: [`I don’t see an open task like “${m[1].trim()}”. What is it called exactly?`], actions: [] };
  }

  if ((m = t.match(/^(?:note(?: down| that)?|remember|jot(?: down)?)\s*:?\s+(.+)/i))) {
    const body = m[1].trim();
    return {
      bubbles: ["Prepared a new note."],
      actions: [{ type: "add_note", body }],
    };
  }

  if ((m = t.match(/^(?:doc|new doc|start (?:a )?doc(?: called| on| about)?)\s*:?\s+(.+)/i))) {
    return { bubbles: [`Prepared a document called “${m[1].trim()}”.`], actions: [{ type: "add_doc", title: m[1].trim(), body: "" }] };
  }

  if ((m = t.match(/^(?:goal|new goal|my goal is(?: to)?)\s*:?\s+(.+)/i))) {
    return { bubbles: ["Prepared a new goal."], actions: [{ type: "add_goal", title: m[1].trim() }] };
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
      bubbles: [hours ? `Prepared a ${fmtHours(hours)}h work log for “${text}”.` : `Prepared a work log for “${text}”.`],
      actions: [{ type: "log_work", text, hours }],
    };
  }

  if ((m = t.match(/^(?:i'?m )?(?:learning|studying|course)\s*:?\s+(.+)/i))) {
    return { bubbles: [`Prepared “${m[1].trim()}” for Learning.`], actions: [{ type: "add_education", title: m[1].trim() }] };
  }

  if (/(?:plan|organize|structure).*(?:focused?\s*)?(?:hour|block|session)|next focused (?:hour|block)/.test(low)) {
    const c = contextBits();
    const candidates = c.overdue.concat(c.dueToday, c.open.filter(task => !c.overdue.includes(task) && !c.dueToday.includes(task)))
      .filter((task, index, all) => all.findIndex(item => item.id === task.id) === index)
      .slice(0, 3);
    if (!candidates.length) {
      return { bubbles: ["Use 5 minutes to name one outcome, 45 minutes to make it real, and 10 minutes to close the loop. Your task list is clear, so choose the outcome first."], actions: [] };
    }
    const lead = candidates[0];
    const carry = candidates.slice(1).map(task => "• " + task.title).join("\n");
    return {
      bubbles: [
        `Next hour: 5 minutes to define “done” for “${lead.title}”, 45 minutes on the work, then 10 minutes to record the result and choose the next step.`,
        carry ? "Keep these outside the block:\n" + carry : "Keep everything else outside the block.",
      ],
      actions: [],
    };
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
    return { bubbles: [pick(["Ready.", "Here and ready.", "Good. What are we working on?"])], actions: [] };
  }

  return {
    bubbles: [
      "I didn't catch the intended outcome.",
      "Try “remind me to…”, “log 2h on…”, “note:…”, or tell me what should change.",
    ],
    actions: [],
  };
}

const SOL_SYSTEM = `You are Aero, the personal operating layer inside Lyfe. Turn the user's intended outcome into a clear answer, an inspectable plan, or a reviewable Lyfe change. Use only the permitted context and cite the source by name when imported ChatGPT, Gemini, Gmail, Connect, or Library context materially shaped the answer. Never claim to have opened, remembered, connected, or changed something when the supplied context does not prove it.

Voice: calm, sharp, and human. Lead with the answer. Use plain language, natural capitalization, and the fewest words that preserve meaning. No corporate assistant phrases, therapy clichés, guilt, forced cheerfulness, fake intimacy, emojis as decoration, or research terminology in ordinary conversation. Do not say “protect that feeling”, “connect a brain”, “you've got this”, or “memory that earns persistence”. Ask one precise clarification only when it changes the result.

Answer general questions when the active engine has enough knowledge. Say plainly when live information or a source is unavailable. Do not invent current facts, account connections, memory, citations, or completed work.

You can propose reversible changes inside Lyfe. When the conversation calls for it, end your reply with a fenced json block containing an array of actions. The user will see a preview and must approve it:

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
- memory_upsert {claim, memoryType? "episodic"|"semantic"|"project"|"procedural", scope?}
- memory_forget {query}

Rules: only include the block when there is genuinely something to change. Say that you are proposing the change, never that it is already saved, sent, completed, or applied. Never propose sending a message, spending money, deleting external data, or another irreversible external action. Inferred preferences are not persistent facts. Only use memory_upsert when the user explicitly asks you to remember or teach something. If the user is just chatting or venting, just be present; no actions needed.

Example of a perfect reply:
User: "remind me to call the bank tomorrow, also im so tired lately"
Aero:
I’ve prepared the bank call for tomorrow. Review it before it changes Lyfe.

You also mentioned feeling tired lately. Want me to make today’s plan lighter?

\`\`\`json
[{"type":"add_task","title":"call the bank","due":"TOMORROW_DATE"}]
\`\`\`
(with TOMORROW_DATE as the real date from the snapshot)`;

function contextSnapshot(packOverride) {
  const pack = packOverride || aeroContextPack();
  return `Today is ${fmtLongISO(todayStr())} (${todayStr()}).\n${AeroCore.summarizeForPrompt(pack)}`;
}

function solLocalRouted(raw, route) {
  const steps = route && Array.isArray(route.steps) ? route.steps : [];
  if (steps.length < 2) return solLocal(raw);
  const replies = steps.map(step => solLocal(step.instruction));
  return {
    bubbles: replies.flatMap(reply => reply.bubbles || []).slice(0, 6),
    actions: replies.flatMap(reply => reply.actions || []).slice(0, 8),
  };
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

/* ----- Aero: local open-model adapter (Ollama) ----- */

async function askOllama(turnContext) {
  const s = state.data.settings;
  const history = activeAeroMessages().slice(-20)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) throw new Error("no user message");

  const base = (s.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
  const model = s.ollamaModel || "qwen3:8b";
  const sys = SOL_SYSTEM + "\n\n--- current context ---\n" + contextSnapshot(turnContext)
    + "\n\nReturn only a JSON object matching the provided schema with bubbles and actions. Do not use markdown fences. /no_think";
  const res = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: AeroCore.responseSchema,
      messages: [{ role: "system", content: sys }].concat(history),
      options: { temperature: 0.35 },
    }),
  });
  if (!res.ok) throw new Error("ollama " + res.status);
  const data = await res.json();
  let text = (data.message && data.message.content) || "";
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  try {
    const parsed = JSON.parse(text);
    return {
      bubbles: Array.isArray(parsed.bubbles) ? parsed.bubbles.map(String).filter(Boolean).slice(0, 4) : ["i need one more detail."],
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(AeroCore.validateAction).filter(Boolean) : [],
      assumption: String(parsed.assumption || ""),
    };
  } catch (error) {
    return parseSolOutput(text);
  }
}

async function askGroq(raw, attachments) {
  if (!(window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroGatewayEnabled)) {
    throw new Error("Sign in before using the protected Groq route.");
  }
  const response = await LyfeCloud.invokeAero({
    prompt: String(raw || "").slice(0, 4000),
    date: todayStr(),
    kind: AeroCore.classifyIntent(raw),
    images: (attachments || []).map(image => image.data).slice(0, 3),
  });
  const parsed = response && response.result ? response.result : {};
  return {
    bubbles: Array.isArray(parsed.bubbles) ? parsed.bubbles.map(String).filter(Boolean).slice(0, 4) : ["I need one more detail."],
    actions: Array.isArray(parsed.actions) ? parsed.actions.map(AeroCore.validateAction).filter(Boolean) : [],
    assumption: String(parsed.assumption || ""),
    model: String(response && response.model || "openai/gpt-oss-120b"),
  };
}

/* ----- Aero: conversation flow ----- */

let solChain = Promise.resolve();
let brainWarned = false;
let ollamaDown = false;   // session flag: stop hammering a dead endpoint
let groqWarned = false;
let groqDownUntil = 0;

function handleUserMessage(text, attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 3) : [];
  const imageTurn = safeAttachments.length > 0;
  const signal = String(text || "").trim() || (imageTurn ? "Describe this image and help me with what it contains." : "");
  if (!signal) return;
  const context = aeroContextPack(null, signal);
  const epistemic = AeroCore.epistemicDecision({ signal, context });
  const settings = state.data.settings;
  const providerChoice = ["auto", "ollama", "groq", "offline"].includes(settings.provider) ? settings.provider : "auto";
  const cloudReady = settings.aeroCloudEnabled === true
    && providerChoice !== "offline" && providerChoice !== "ollama"
    && !!(window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroGatewayEnabled)
    && Date.now() >= groqDownUntil;
  const route = AeroCore.routePlan({
    signal,
    context,
    engines: {
      ollama: (providerChoice === "auto" || providerChoice === "ollama") && !ollamaDown,
      groq: cloudReady,
    },
    cloudAllowed: cloudReady,
  });
  const started = state.data.settings.aeroLocalLearning !== false
    ? AeroCore.beginEpisode(state.data.aero, signal, context.surface, context.id)
    : { aero: state.data.aero, episode: { id: null } };
  state.data.aero = started.aero;
  pushChat("user", signal, { episodeId: started.episode.id, contextId: context.id, attachments: safeAttachments });
  solChain = solChain.then(async () => {
    const s = state.data.settings;
    const provider = ["auto", "ollama", "groq", "offline"].includes(s.provider) ? s.provider : "auto";
    let usedEngine = "built-in";
    let usedReason = route.privacy === "private" ? "private request kept local" : "local deterministic route";
    let reply = null;
    if (epistemic.mode === "clarify") {
      reply = { bubbles: [epistemic.question], actions: [] };
    } else {
      const mayUseOllama = !imageTurn && (provider === "ollama" || provider === "auto") && !ollamaDown;
      const mayUseGroq = (provider === "groq" || provider === "auto")
        && s.aeroCloudEnabled === true && (route.privacy === "standard" || imageTurn)
        && !!(window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroGatewayEnabled)
        && Date.now() >= groqDownUntil;
      if (mayUseOllama) {
        try {
          showTyping();
          reply = await askOllama(context);
          usedEngine = "ollama";
          usedReason = "local model available";
        } catch (err) {
          ollamaDown = true;   // do not retry a dead endpoint again this session
          if (!brainWarned) {
            brainWarned = true;
            toast(mayUseGroq ? "Aero: Ollama is offline, trying Groq" : "Aero: Ollama is offline, using local tools");
          }
        } finally {
          hideTyping();
        }
      }
      if (!reply && mayUseGroq) {
        try {
          showTyping();
          reply = await askGroq(signal, safeAttachments);
          usedEngine = "groq";
          usedReason = imageTurn ? "attached image + current prompt only" : "current cloud-safe prompt only";
        } catch (error) {
          const status = Number(error && error.status || 0);
          groqDownUntil = Date.now() + (status === 429 ? 60_000 : 30_000);
          if (!groqWarned) {
            groqWarned = true;
            toast(error && error.message ? error.message : "Groq is unavailable; using local tools");
          }
        } finally {
          hideTyping();
        }
      }
      if (!reply) {
        reply = imageTurn
          ? { bubbles: ["The image is saved in this Aero workspace. Visual analysis needs the protected Groq route, which is unavailable right now."], actions: [] }
          : solLocalRouted(signal, route);
        usedReason = imageTurn ? "image kept in your workspace" : (route.privacy === "private" ? "private request kept local" : "local fallback");
      }
    }
    const actions = (reply.actions || []).map(AeroCore.validateAction).filter(Boolean);
    let bubbles = Array.isArray(reply.bubbles) && reply.bubbles.length ? reply.bubbles : ["i need one more detail."];
    if (epistemic.boundary && !bubbles.some(item => /cannot send|can't send|draft-only/i.test(item))) bubbles.unshift(epistemic.note);
    if (reply.assumption) bubbles.unshift("i'm assuming " + String(reply.assumption).trim() + ". correct me if that's wrong.");
    if (actions.length) {
      const summary = AeroCore.actionSummary(actions);
      bubbles = bubbles.map(item => String(item)
        .replace(/\b(?:saved|added|logged|ticked off|crossed out|done and dusted)\s*✓?/gi, "prepared")
        .replace(/\b(?:i've|i have)\s+(?:saved|added|logged)\b/gi, "i've prepared"));
      if (!bubbles.some(item => /preview|approve|apply|prepared/i.test(item))) bubbles.push(summary + " is ready for your approval.");
    }
    const harnessRun = actions.length && window.AeroHarness ? AeroHarness.createRun({
      threadId: state.data.aeroActiveThreadId,
      episodeId: started.episode.id,
      intent: signal,
      actions,
    }) : null;
    if (harnessRun) state.data.aeroRuns.push(harnessRun);
    await solSay(bubbles, {
      episodeId: started.episode.id,
      contextId: context.id,
      route: {
        engine: usedEngine,
        reason: usedReason,
        steps: route.steps.length,
        privacy: route.privacy,
      },
      proposal: actions.length ? { actions, status: "pending", runId: harnessRun ? harnessRun.id : null } : null,
    });
    if (!actions.length) {
      if (started.episode.id) state.data.aero = AeroCore.finishEpisode(state.data.aero, started.episode.id, "answered", { provider: usedEngine });
      save();
    }
  }).catch((error) => {
    hideTyping();
    console.error("Aero turn failed", error);
    pushChat("sol", "That turn stopped before it finished. Your message is still saved, so you can retry.", { route: { engine: "built-in", reason: "recovered safely", steps: 1, privacy: route.privacy } });
  });
}

/* ----- Aero: attention governor ----- */

function aeroAttentionState() {
  if (!state.data.aeroAttention || typeof state.data.aeroAttention !== "object") {
    state.data.aeroAttention = { day: "", proactiveCount: 0, lastProactiveAt: 0, proactiveFingerprints: [], notifications: [] };
  }
  const attention = state.data.aeroAttention;
  if (!Array.isArray(attention.notifications)) attention.notifications = [];
  if (!Array.isArray(attention.proactiveFingerprints)) attention.proactiveFingerprints = [];
  const day = todayStr();
  if (attention.day !== day) {
    attention.day = day;
    attention.proactiveCount = 0;
  }
  return attention;
}

function aeroAttentionSignals() {
  const today = todayStr();
  const open = state.data.tasks.filter(task => task.status !== "done" && task.due);
  const importantOverdue = open.filter(task => task.important && task.due < today);
  const overdue = open.filter(task => !task.important && task.due < today);
  const dueToday = open.filter(task => task.due === today);
  const pendingPlans = state.data.chat.filter(message => message.proposal && message.proposal.status === "pending");
  const signals = [];
  importantOverdue.forEach(task => signals.push({
    fingerprint: `important-overdue:${task.id}:${task.due}`,
    priority: "urgent",
    title: `${task.title} needs a decision`,
    detail: `Important and overdue since ${fmtShort(task.due)}. Complete it, move it, or clear the alarm.`,
    prompt: `Help me decide what to do with the overdue task "${task.title}".`,
  }));
  if (overdue.length) signals.push({
    fingerprint: `overdue:${today}:${overdue.map(task => task.id).sort().join(",")}`,
    priority: "important",
    title: `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}`,
    detail: `Start with ${overdue[0].title}. The rest can wait in Updates.`,
    prompt: "Help me clear or reschedule my overdue tasks.",
  });
  if (dueToday.length) signals.push({
    fingerprint: `due-today:${today}:${dueToday.map(task => task.id).sort().join(",")}`,
    priority: "normal",
    title: `${dueToday.length} due today`,
    detail: `First up: ${dueToday[0].title}.`,
    prompt: "Plan the tasks I have due today.",
  });
  if (pendingPlans.length) signals.push({
    fingerprint: `pending-plans:${pendingPlans.map(message => message.id).sort().join(",")}`,
    priority: "normal",
    title: `${pendingPlans.length} ${pendingPlans.length === 1 ? "plan is" : "plans are"} waiting for review`,
    detail: "Aero has not applied anything. Review when you are ready.",
    prompt: "Show me the plans waiting for review.",
  });
  return signals;
}

function syncAeroWorkNotifications(shouldSave) {
  const attention = aeroAttentionState();
  const known = new Set(attention.notifications.map(item => item.fingerprint));
  let changed = false;
  aeroAttentionSignals().forEach(signal => {
    if (known.has(signal.fingerprint)) return;
    attention.notifications.unshift(Object.assign({ id: uid(), createdAt: Date.now(), read: false }, signal));
    known.add(signal.fingerprint);
    changed = true;
  });
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const kept = attention.notifications.filter(item => item.createdAt >= cutoff).slice(0, 60);
  if (kept.length !== attention.notifications.length) changed = true;
  attention.notifications = kept;
  if (changed && shouldSave !== false) save();
  return changed;
}

function aeroUnreadNotificationCount() {
  const attention = aeroAttentionState();
  return attention.notifications.filter(item => !item.read).length;
}

function canAeroSpeakFirst(priority) {
  const mode = state.data.settings.aeroProactiveMode || "brief";
  if (mode === "off" || mode === "quiet") return false;
  if (mode === "important" && priority !== "urgent") return false;
  const attention = aeroAttentionState();
  const count = Number(attention.proactiveCount || 0);
  if (count >= 2) return false;
  if (count >= 1 && priority !== "urgent") return false;
  if (attention.lastProactiveAt && Date.now() - attention.lastProactiveAt < 2 * 60 * 60 * 1000) return false;
  return true;
}

function recordAeroProactive(signal) {
  const attention = aeroAttentionState();
  attention.proactiveCount = Math.min(2, Number(attention.proactiveCount || 0) + 1);
  attention.lastProactiveAt = Date.now();
  attention.proactiveFingerprints.push(signal.fingerprint);
  attention.proactiveFingerprints = attention.proactiveFingerprints.slice(-40);
  save();
}

let nudgeTimer = null;

function scheduleNudge() {
  clearTimeout(nudgeTimer);
  const mins = 240 + Math.random() * 120;
  nudgeTimer = setTimeout(fireNudge, mins * 60 * 1000);
}

async function fireNudge() {
  syncAeroWorkNotifications();
  const attention = aeroAttentionState();
  const signal = aeroAttentionSignals().find(item => item.priority === "urgent" && !attention.proactiveFingerprints.includes(item.fingerprint));
  if (signal && canAeroSpeakFirst(signal.priority)) {
    await solSay([`${signal.title}. ${signal.detail}`], { proactive: true });
    recordAeroProactive(signal);
  }
  scheduleNudge();
}

async function maybeGreet() {
  syncAeroWorkNotifications(false);
  const last = state.data.chat[state.data.chat.length - 1];
  if (last && Date.now() - last.ts < 45 * 60 * 1000) return;
  const attention = aeroAttentionState();
  const signals = aeroAttentionSignals();
  const signal = signals.find(item => item.priority === "urgent" && !attention.proactiveFingerprints.includes(item.fingerprint))
    || signals.find(item => item.priority === "important" && !attention.proactiveFingerprints.includes(item.fingerprint))
    || signals.find(item => item.priority === "normal" && item.fingerprint.startsWith("due-today:") && !attention.proactiveFingerprints.includes(item.fingerprint));
  if (!signal || !canAeroSpeakFirst(signal.priority)) return;
  await sleep(800);
  await solSay([`${signal.title}. ${signal.detail}`], { proactive: true });
  recordAeroProactive(signal);
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
       <p class="fld-note">Important tasks alert until you acknowledge them.</p>
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
    <button type="button" class="icon-btn" data-action="remove-ms-row" title="Remove" aria-label="Remove milestone">✕</button>
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
    `<div class="modal-head"><h3>${e ? "Edit learning entry" : "New learning entry"}</h3></div>
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

function aeroContextModal() {
  const pack = aeroContextPack();
  const enabled = state.data.settings.aeroSources || {};
  const ids = ["today", "tracking", "library", "connect", "gmail", "profile"];
  openModal(
    `<div class="modal-head"><div><span class="settings-kicker">AERO CONTEXT</span><h3>What Aero can use</h3></div></div>
     <p class="aero-modal-lede">This is the bounded context pack for the current turn. Disabled sources are not added to model prompts.</p>
     <div class="aero-context-list">${ids.map(id => {
       const source = pack.sources.find(item => item.id === id);
       return `<article class="${enabled[id] === false ? "is-off" : ""}"><span>${esc(aeroSourceLabel(id))}</span><b>${enabled[id] === false ? "Off" : source ? "Available" : "Enabled, no current data"}</b><p>${esc(source ? source.detail : id === "gmail" ? "Connect Gmail and load Today to make recent metadata available." : "No recent items in this source.")}</p></article>`;
     }).join("")}</div>
     <div class="modal-actions"><button type="button" class="btn" data-action="modal-close">Close</button><button type="button" class="btn btn-primary" data-action="settings">Manage permissions</button></div>`,
    "aero-context-modal"
  );
}

function aeroNotificationsModal() {
  syncAeroWorkNotifications(false);
  const attention = aeroAttentionState();
  const items = attention.notifications.slice().sort((a, b) => b.createdAt - a.createdAt);
  const body = items.length ? `<div class="aero-notification-list">${items.map(item => `<article class="is-${esc(item.priority)} ${item.read ? "is-read" : ""}"><span>${item.priority === "urgent" ? "Important" : item.priority === "important" ? "Needs attention" : "Update"}</span><div><h4>${esc(item.title)}</h4><p>${esc(item.detail)}</p><small>${esc(timeAgo(item.createdAt))}</small></div>${item.prompt ? `<button type="button" class="btn btn-sm" data-action="aero-notification-open" data-id="${esc(item.id)}">Open</button>` : ""}</article>`).join("")}</div>` : `<div class="aero-notification-empty"><h3>All clear.</h3><p>Aero keeps routine activity here instead of interrupting you.</p></div>`;
  attention.notifications.forEach(item => { item.read = true; });
  save();
  openModal(
    `<div class="modal-head"><div><span class="settings-kicker">AERO UPDATES</span><h3>Quiet unless it matters.</h3></div></div>
     <p class="aero-modal-lede">Aero starts at most one conversation a day. A second is reserved for something urgent.</p>
     ${body}
     <div class="modal-actions"><button type="button" class="btn" data-action="modal-close">Done</button><button type="button" class="btn btn-primary" data-action="settings">Notification settings</button></div>`,
    "aero-notifications-modal"
  );
}

function aeroTeachModal() {
  openModal(
    `<div class="modal-head"><div><span class="settings-kicker">TEACH AERO</span><h3>Make one thing explicit</h3></div></div>
     <p class="aero-modal-lede">Explicit memories start active because you chose them. Inferred patterns never get that privilege automatically.</p>
     <form data-form="aero-teach" class="aero-teach-form">
       ${fld("Memory", `<textarea name="claim" required maxlength="800" rows="4" placeholder="When I say ‘research this’, compare the contribution, evidence, failure modes and what changes my decision."></textarea>`)}
       <div class="fld-row">
         ${fld("Type", selectHtml("memoryType", [["procedural", "Procedure: how I do something"], ["semantic", "Preference or stable fact"], ["project", "Specific to a project"], ["episodic", "A past decision or event"]], "procedural"))}
         ${fld("Scope", `<input type="text" name="scope" maxlength="100" value="global" placeholder="global or project name">`)}
       </div>
       ${modalActions("Teach Aero")}
     </form>`,
    "aero-context-modal"
  );
}

function exportAeroTrainingExamples() {
  const s = state.data.settings;
  if (!s.aeroTrainingConsent) {
    toast("Enable consented training export in Settings first");
    return;
  }
  const examples = AeroCore.trainingExamples(state.data.aero, state.data.chat);
  if (!examples.length) {
    toast("Rate some successful Aero outcomes first");
    return;
  }
  const blob = new Blob([examples.map(item => JSON.stringify(item)).join("\n") + "\n"], { type: "application/jsonl" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "aero-consented-training-" + todayStr() + ".jsonl";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  toast(examples.length + " consented example" + (examples.length === 1 ? "" : "s") + " exported");
}

function accountRowHtml() {
  if (CLOUD_MODE && window.LyfeCloud && LyfeCloud.user) {
    const u = LyfeCloud.user;
    return `<div class="acct-row">
      <div class="acct-info"><span class="acct-dot on"></span>
        <div><b>${esc(u.name || "Signed in")}</b><span>${esc(u.email || "synced to your account")}</span></div></div>
      <button type="button" class="btn btn-sm" data-action="sign-out">Sign out</button>
    </div>`;
  }
  const canSignIn = !!(window.LyfeCloud && LyfeCloud.configured);
  return `<div class="acct-row">
    <div class="acct-info"><span class="acct-dot"></span>
      <div><b>Guest on this device</b><span>Everything stays in this browser only</span></div></div>
    ${canSignIn ? `<button type="button" class="btn btn-sm" data-action="sign-in">Sign in to sync</button>` : ""}
  </div>`;
}

function aeroPresenceSettingsHtml() {
  const signedIn = !!(CLOUD_MODE && window.LyfeCloud && LyfeCloud.user);
  if (!signedIn) {
    return `<div class="settings-integration-row"><span class="acct-dot"></span><div><b>Sign in to protect approvals</b><small>Device verification belongs to one private Lyfe account.</small></div></div>`;
  }
  if (!(window.LyfeCloud && LyfeCloud.aeroPresenceEnabled)) {
    return `<div class="settings-integration-row"><span class="acct-dot"></span><div><b>Secure approvals unavailable</b><small>This deployment has not enabled transaction-bound device verification.</small></div></div>`;
  }
  if (aeroPresenceStatus.loading && !aeroPresenceStatus.loaded) {
    return `<div class="settings-integration-row"><span class="acct-dot"></span><div><b>Checking approval security…</b><small>No setting changes while Aero verifies the account.</small></div></div>`;
  }
  if (aeroPresenceStatus.error) {
    return `<div class="settings-integration-row"><span class="acct-dot"></span><div><b>Approval status unavailable</b><small>${esc(aeroPresenceStatus.error)} Aero will not assume review-click approval.</small></div></div>`;
  }
  const unavailable = aeroPresenceStatus.loaded && aeroPresenceStatus.availableHere === false;
  if (aeroPresenceStatus.enrolled) {
    const credential = Array.isArray(aeroPresenceStatus.credentials) ? aeroPresenceStatus.credentials[0] : null;
    const name = credential && credential.friendlyName || "Secure approval device";
    return `<div class="settings-integration-row"><span class="acct-dot on"></span><div><b>Device verification is on</b><small>${unavailable ? "This browser cannot prompt for the enrolled approval device." : `${esc(name)} · every explicit Aero change is verified against its exact contract.`}</small></div><button type="button" class="btn btn-danger" data-action="aero-presence-remove" ${unavailable ? "disabled" : ""}>Remove</button></div>
      <p class="fld-note">Aero still records misses automatically. Only explicit record or memory changes invoke Windows Hello, a passkey, or your security key. Removing the device revokes future use and keeps prior approval receipts.</p>`;
  }
  return `<div class="settings-integration-row"><span class="acct-dot"></span><div><b>Review click only</b><small>${unavailable ? "Open sonnesystems.com in a WebAuthn-capable browser to enroll." : "Add device verification so a stolen session cannot silently commit an Aero plan."}</small></div><button type="button" class="btn btn-primary" data-action="aero-presence-enroll" ${unavailable ? "disabled" : ""}>Add secure approval</button></div>
    <p class="fld-note">One approval device can be active in v0.1. If you lose it, operator-assisted recovery is required. Enrollment never happens without your device's native prompt.</p>`;
}

async function refreshAeroPresenceStatus() {
  if (!(CLOUD_MODE && window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroPresenceEnabled)) return;
  aeroPresenceStatus.loading = true;
  const current = document.getElementById("aero-presence-settings");
  if (current) current.innerHTML = aeroPresenceSettingsHtml();
  try {
    const result = await LyfeCloud.aeroPresenceStatus();
    aeroPresenceStatus = Object.assign({ loaded: true, loading: false, supported: true, enrolled: false, credentials: [] }, result || {});
  } catch (error) {
    aeroPresenceStatus = { loaded: true, loading: false, supported: false, enrolled: false, credentials: [], error: error && error.message || "Secure approval status is unavailable." };
  }
  const target = document.getElementById("aero-presence-settings");
  if (target) target.innerHTML = aeroPresenceSettingsHtml();
}

function settingsModal() {
  const s = state.data.settings;
  const sources = s.aeroSources || {};
  const proof = AeroCore.metrics(state.data.aero);
  const vault = window.AeroKnowledge ? AeroKnowledge.stats() : { records: 0, sources: {} };
  const vaultSources = Object.keys(vault.sources || {}).map(key => `${key} ${vault.sources[key]}`).join(" · ") || "No imports yet";
  const falsePromotion = proof.falsePromotionRate == null ? "&mdash;" : Math.round(proof.falsePromotionRate * 100) + "%";
  const groqReady = !!(window.LyfeCloud && LyfeCloud.configured && LyfeCloud.aeroGatewayEnabled && LyfeCloud.user);
  const sourceToggle = (id, title, detail) => `<label class="aero-source-toggle"><input type="checkbox" name="source_${id}" ${sources[id] === false ? "" : "checked"}><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></label>`;
  openModal(
    `<div class="settings-hero"><div><span class="settings-kicker">LYFE · AERO</span><h3>Settings</h3><p>Account, context, models, and privacy.</p></div><img src="../assets/aero_logo.svg" alt=""></div>
     <form data-form="settings" class="settings-form">
       <section class="settings-section settings-account">
         <div class="settings-section-copy"><span>01</span><div><h4>Account</h4><p>Your Lyfe identity and sync.</p></div></div>
         <div>${accountRowHtml()}<a class="settings-inline-link" href="connect.html#profile">Open Connect profile →</a></div>
       </section>
       <section class="settings-section">
         <div class="settings-section-copy"><span>02</span><div><h4>Aero context</h4><p>Choose what Aero may use.</p></div></div>
         <div class="aero-source-controls">
           ${sourceToggle("today", "Today", "Due items and the immediate plan")}
           ${sourceToggle("tracking", "Tracking", "Tasks, projects, goals and work logs")}
           ${sourceToggle("library", "Library", "Notes, docs and saved items")}
           ${sourceToggle("connect", "Connect", "People, threads, opportunities and workspace activity")}
           ${sourceToggle("gmail", "Gmail", "Recent sender, subject and snippet metadata only")}
           ${sourceToggle("profile", "Profile", "The identity and goals you chose to add")}
           ${sourceToggle("knowledge", "Knowledge vault", "ChatGPT, Gemini, and other files imported on this device")}
           <p class="fld-note">Turning a source off keeps it out of Aero. It does not delete the source.</p>
         </div>
       </section>
       <section class="settings-section settings-knowledge">
         <div class="settings-section-copy"><span>03</span><div><h4>Knowledge vault</h4><p>Bring your past AI work into Aero.</p></div></div>
         <div class="settings-stack">
           <div class="knowledge-status"><span><b>${vault.records}</b><small>local records</small></span><p>${esc(vaultSources)}</p></div>
           <div class="settings-data-actions"><button type="button" class="btn btn-primary" data-action="aero-import-knowledge">Import files</button>${vault.records ? `<button type="button" class="btn btn-danger" data-action="aero-clear-knowledge">Clear vault</button>` : ""}</div>
           <input id="aero-knowledge-input" type="file" accept=".json,.html,.htm,.txt,.md,application/json,text/html,text/plain" multiple hidden>
           <p class="fld-note">Select extracted ChatGPT <b>conversations.json</b>, Gemini Takeout JSON/HTML, or text and Markdown files. Imports stay in this browser and are not synced.</p>
         </div>
       </section>
       <section class="settings-section">
         <div class="settings-section-copy"><span>04</span><div><h4>Memory</h4><p>Aero keeps only useful, reviewable patterns.</p></div></div>
         <div class="settings-stack">
           <div class="aero-eval-strip"><div><b>${proof.scored}</b><span>results rated</span></div><div><b>${proof.compressionSamples}</b><span>rated repeats</span></div><div><b>${falsePromotion}</b><span>bad memory</span></div><div><b>${proof.proofReady ? "Working" : "Learning"}</b><span>proof status</span></div></div>
           <label class="settings-check"><input type="checkbox" name="aeroLocalLearning" ${s.aeroLocalLearning !== false ? "checked" : ""}><span><b>Learn from rated outcomes</b><small>Track successes and misses so shorter prompts never hide lower accuracy.</small></span></label>
           <label class="settings-check"><input type="checkbox" name="aeroTrainingConsent" ${s.aeroTrainingConsent ? "checked" : ""}><span><b>Allow manual example export</b><small>Only results you marked helpful. Never automatic.</small></span></label>
           <div class="settings-data-actions"><button type="button" class="btn" data-action="aero-teach">Teach Aero</button><button type="button" class="btn" data-action="aero-training-export">Export consented examples</button><button type="button" class="btn btn-danger" data-action="aero-reset">Reset Aero memory</button></div>
         </div>
       </section>
       <section class="settings-section settings-security">
         <div class="settings-section-copy"><span>05</span><div><h4>Approval security</h4><p>Bind each explicit change to you and its exact plan.</p></div></div>
         <div id="aero-presence-settings" class="settings-stack">${aeroPresenceSettingsHtml()}</div>
       </section>
       <section class="settings-section settings-gmail">
         <div class="settings-section-copy"><span>06</span><div><h4>Connections</h4><p>Connected is separate from allowed.</p></div></div>
         <div class="settings-integration-row"><span class="gmail-g">G</span><div><b>${window.LyfeCloud && LyfeCloud.gmailToken ? "Gmail connected" : "Gmail not connected"}</b><small>Read-only metadata and snippets. Nothing is saved to Library unless you choose Save.</small></div><button type="button" class="btn" data-action="gmail-connect">${window.LyfeCloud && LyfeCloud.gmailToken ? "Reconnect" : "Connect Gmail"}</button></div>
       </section>
       <section class="settings-section">
         <div class="settings-section-copy"><span>07</span><div><h4>Model routing</h4><p>Aero chooses an engine; Aero remains the system.</p></div></div>
         <div class="settings-stack">
           ${fld("Routing mode", selectHtml("provider", [["auto", "Automatic · local first"], ["ollama", "Ollama only"], ["groq", "Groq for cloud-safe prompts"], ["offline", "Built-in tools only"]], ["auto", "ollama", "groq", "offline"].includes(s.provider) ? s.provider : "auto"))}
           <label class="settings-check"><input type="checkbox" name="aeroCloudEnabled" ${s.aeroCloudEnabled ? "checked" : ""}><span><b>Use free Groq for cloud-safe prompts</b><small>Sends only the current prompt. Lyfe context stays local. If free capacity runs out, Aero falls back locally instead of charging.</small></span></label>
           <div class="fld-row">
             ${fld("Ollama address", `<input type="text" name="ollamaUrl" value="${esc(s.ollamaUrl || "http://localhost:11434")}" placeholder="http://localhost:11434">`)}
             ${fld("Ollama model", `<input type="text" name="ollamaModel" value="${esc(s.ollamaModel || "qwen3:8b")}" placeholder="qwen3:8b">`)}
           </div>
           <div class="model-route-grid"><article><b>Aero local</b><span>Built-in · ready</span></article><article><b>Ollama</b><span>Private local model</span></article><article><b>Groq GPT-OSS</b><span>${groqReady ? "Free protected gateway available" : "Free route · sign in to enable"}</span></article><article><b>GPT / Codex</b><span>History import ready · live bridge not connected</span></article><article><b>Gemini</b><span>History import ready · live bridge not connected</span></article><article><b>Inkling</b><span>Evaluated · multimodal specialist candidate</span></article></div>
           <div class="settings-data-actions"><button type="button" class="btn" data-action="ollama-test">Test local model</button><button type="button" class="btn" data-action="groq-test">Test Groq route</button></div>
           <p class="fld-note">Private and workspace requests stay local even when Groq is enabled. Aero never treats a consumer AI subscription as API access.</p>
         </div>
       </section>
       <section class="settings-section">
         <div class="settings-section-copy"><span>08</span><div><h4>Personal & display</h4><p>Profile basics and appearance.</p></div></div>
           <div><div class="fld-row">${fld("Your name", `<input type="text" name="name" maxlength="60" value="${esc(s.name || "")}" placeholder="How Aero greets you">`)}${fld("Appearance", selectHtml("theme", [["auto", "Follow the time"], ["light", "Pearl light"], ["dark", "Graphite dark"]], s.theme === "day" ? "light" : s.theme === "night" ? "dark" : (["auto", "light", "dark"].includes(s.theme) ? s.theme : "auto")))}${fld("Aero reaches out", selectHtml("aeroProactiveMode", [["brief", "One useful check-in a day"], ["important", "Urgent only"], ["quiet", "Updates panel only"], ["off", "Never"]], ["brief", "important", "quiet", "off"].includes(s.aeroProactiveMode) ? s.aeroProactiveMode : "brief"))}${fld("Interface sounds", selectHtml("sound", [["on", "On"], ["off", "Off"]], s.sound === false ? "off" : "on"))}</div><div class="fld-row">${fld("Age (optional)", `<input type="number" name="age" min="1" max="120" value="${esc(s.age || "")}" placeholder="Only if useful to you">`)}${fld("Country (optional)", `<input type="text" name="country" maxlength="56" value="${esc(s.country || "")}" placeholder="Used for your profile">`)}</div><p class="fld-note">Routine work stays in Updates. Aero can start one conversation a day; only an urgent item may add a second.</p></div>
       </section>
       <section class="settings-section settings-data">
         <div class="settings-section-copy"><span>09</span><div><h4>Backups</h4><p>Download or restore Lyfe data.</p></div></div>
         <div><p class="settings-data-note">${CLOUD_MODE ? "Your account is synced and also cached on this device for offline use." : "You are using Lyfe on this device. A backup is the easiest way to move or protect it."}</p><div class="settings-data-actions"><button type="button" class="btn" data-action="export">Download backup</button><button type="button" class="btn" data-action="import">Restore backup</button></div></div>
       </section>
       ${modalActions("Save settings")}
     </form>`,
    "settings-modal"
  );
}

function viewSaved() {
  const items = state.data.saved.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  const body = items.length ? `<div class="saved-library-grid">${items.map(item => `
    <article class="saved-library-card panel">
      <header><span>${esc(item.source || "Saved")}</span><time>${esc(timeAgo(item.savedAt))}</time></header>
      <h2>${esc(item.title || "Untitled")}</h2>
      ${item.body ? `<p>${esc(String(item.body).slice(0, 360))}</p>` : ""}
      <footer><span>${esc(item.kind || "item")}</span><button class="linklike danger" type="button" data-action="delete-saved" data-id="${esc(item.id)}">Remove</button></footer>
    </article>`).join("")}</div>` : `<section class="panel saved-library-empty"><span class="eyebrow">SAVED</span><h2>Useful, not urgent.</h2><p>Keep emails, posts, files, and opportunities here.</p><a class="btn" href="connect.html#plans">Open Connect →</a></section>`;
  return pageHead("Saved", `<a class="btn" href="connect.html#plans">Open Connect →</a>`) + body;
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
    const keys = ["tasks", "projects", "goals", "education", "worklog", "notes", "docs", "saved", "chat"];
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

function syncScrollProgress() {
  const root = document.documentElement;
  const max = Math.max(0, root.scrollHeight - window.innerHeight);
  root.style.setProperty("--scroll-progress", max ? String(Math.min(1, Math.max(0, window.scrollY / max))) : "0");
}

function viewAeroWork() {
  const projects = new Map(state.data.projects.map(project => [project.id, project]));
  const threads = state.data.aeroThreads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const cards = threads.map(thread => {
    const messages = state.data.chat.filter(message => message.threadId === thread.id);
    const last = messages[messages.length - 1];
    const project = thread.projectId ? projects.get(thread.projectId) : null;
    const imageCount = messages.reduce((count, message) => count + (message.attachments || []).length, 0);
    const runs = state.data.aeroRuns.filter(run => run.threadId === thread.id);
    const latestRun = runs.length && window.AeroHarness ? AeroHarness.receipt(runs[runs.length - 1]) : null;
    const runLabel = latestRun ? ` · ${latestRun.verified}/${latestRun.total} steps verified · ${latestRun.status.replace(/-/g, " ")}` : "";
    return `<article class="aero-work-card panel">
      <header><span>${project ? esc(project.name) : "GENERAL"}</span><time>${esc(timeAgo(thread.updatedAt))}</time></header>
      <h2>${esc(thread.title || "New conversation")}</h2>
      <p>${esc(last ? snippet(last.text) : "A fresh Aero workspace.")}</p>
      <footer><span>${messages.length} message${messages.length === 1 ? "" : "s"}${imageCount ? " · " + imageCount + " image" + (imageCount === 1 ? "" : "s") : ""}${esc(runLabel)}</span><button class="btn btn-sm" type="button" data-action="aero-open-thread" data-id="${esc(thread.id)}">Open</button></footer>
    </article>`;
  }).join("");
  const empty = `<section class="panel saved-library-empty"><span class="eyebrow">AERO WORK</span><h2>Conversations become project context.</h2><p>Start in Aero. Work is saved here automatically.</p><button class="btn btn-primary" type="button" data-action="aero-new-thread">Start with Aero</button></section>`;
  return pageHead("Aero work", `<button class="btn btn-primary" type="button" data-action="aero-new-thread">New conversation</button>`, "project-linked conversations and images, saved automatically")
    + (cards ? `<div class="aero-work-grid">${cards}</div>` : empty);
}

let scrollProgressFrame = 0;
window.addEventListener("scroll", () => {
  if (scrollProgressFrame) return;
  scrollProgressFrame = requestAnimationFrame(() => {
    scrollProgressFrame = 0;
    syncScrollProgress();
  });
}, { passive: true });

/* Compact product lockup. The page list below carries navigation; the brand
   mark should identify Lyfe rather than becoming another navigation puzzle. */
function sunNav() {
  const activeLabel = (VIEWS.find(v => v.id === topSectionOf(state.view)) || VIEWS[0]).label;
  return `<div class="sunnav product-nav-brand">
    <button type="button" data-action="nav" data-view="today" aria-label="Open Lyfe Today"><img src="../assets/lyfe_logo.svg" alt=""><span><b>Lyfe</b><small>Personal system</small></span></button>
    <span id="sunnav-label">${esc(activeLabel)}</span>
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
  const connectActivity = connectSummary();
  const connectNav = `<a class="nav-item nav-connect" href="connect.html" aria-label="Open Lyfe Connect">
    <span class="nav-connect-mark"><img src="../assets/lyfe_connect_logo.svg" alt=""></span>
    <span>Connect</span>
    ${connectActivity.unread ? `<span class="nav-count">${connectActivity.unread}</span>` : `<span class="nav-connect-pulse" aria-hidden="true"></span>`}
  </a>`;
  document.getElementById("nav").innerHTML = sunNav() + VIEWS.map(v => `
    <button class="nav-item ${topSectionOf(state.view) === v.id ? "active" : ""}" data-action="nav" data-view="${v.id}">
      ${icon(v.id, "nav-ic")}
      <span>${v.label}</span>
      ${v.id === "tracking" && openCt ? `<span class="nav-count">${openCt}</span>` : ""}
      ${v.id === "sol" && state.unread > 0 ? `<span class="nav-dot" title="${state.unread} new"></span>` : ""}
    </button>${v.id === "sol" ? connectNav : ""}`).join("") + hudHtml();
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
  if (ray && lab) lab.textContent = (VIEWS.find(v => v.id === topSectionOf(state.view)) || VIEWS[0]).label;
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
  main.classList.toggle("internal-view", !["today", "sol"].includes(state.view));
  main.dataset.view = state.view;
  let html = "";
  switch (state.view) {
    case "today":     html = viewToday(); break;
    case "sol":       html = viewSol(); break;
    case "tasks":     html = viewTasks(); break;
    case "projects":  html = viewProjects(); break;
    case "goals":     html = viewGoals(); break;
    case "education": html = viewEducation(); break;
    case "work":      html = viewWork(); break;
    case "notes":     html = viewPad("notes"); break;
    case "docs":      html = viewPad("docs"); break;
    case "saved":     html = viewSaved(); break;
    case "aero-work": html = viewAeroWork(); break;
    case "profile":   html = viewProfile(); break;
    default:          html = viewToday();
  }
  if (TRACKING_VIEWS.includes(state.view)) html = sectionTabs("tracking", state.view) + html;
  if (LIBRARY_VIEWS.includes(state.view)) html = sectionTabs("library", state.view) + html;
  if (PROFILE_VIEWS.includes(state.view)) html = sectionTabs("profile", state.view) + html;
  // same-view re-renders (ticking a task, changing a filter) must feel instant -
  // entrance + reveal animations only replay when the view actually changes
  const sameView = renderedView === state.view;
  renderedView = state.view;
  const aeroEntry = state.view === "sol" ? "" : `<button class="aero-global" type="button" data-action="nav" data-view="sol" aria-label="Ask Aero using ${esc(aeroSourceLabel(topSectionOf(state.view)))} context"><img src="../assets/aero_logo.svg" alt=""><span>Ask Aero</span><small>${esc(aeroSourceLabel(topSectionOf(state.view)))}</small></button>`;
  main.innerHTML = `<div class="view-anim${sameView ? " same-view" : ""}">${html}</div>${aeroEntry}`;

  autoDecorate(main, sameView);
  initReveal(main);
  syncScrollProgress();
  tickSky();
  if (state.view === "today") {
    loadGmailInbox(false);
    loadWanderPhoto();
  }

  const det = document.getElementById("done-details");
  if (det) det.addEventListener("toggle", () => { state.doneOpen = det.open; });

  if (state.view === "sol") {
    scrollChat();
    const inp = document.getElementById("sol-input");
    if (inp) inp.focus();
  }
}

function setView(v) {
  v = resolvedViewId(v);
  if (v === "sol" && state.view !== "sol") {
    state.aeroSourceView = topSectionOf(state.view);
    state.aeroObject = aeroActiveObject();
  }
  if (TRACKING_VIEWS.includes(v)) state.trackingView = v;
  if (LIBRARY_VIEWS.includes(v)) state.libraryView = v;
  if (PROFILE_VIEWS.includes(v)) state.profileView = v;
  state.view = v;
  if (v === "sol") state.unread = 0;
  try { location.hash = "/" + (v === "sol" ? "aero" : v); } catch (e) { /* ignore */ }
  render();
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

function openAeroFrom(source, activeObject, prompt) {
  const allowed = ["today", "tracking", "library", "connect", "gmail", "profile"];
  state.aeroSourceView = allowed.includes(source) ? source : topSectionOf(state.view);
  state.aeroObject = activeObject || null;
  state.view = "sol";
  state.unread = 0;
  try { location.hash = "/aero"; } catch (e) { /* ignore */ }
  render();
  const input = document.getElementById("sol-input");
  if (input && prompt) {
    input.value = prompt;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
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
    case "home-tab": {
      const tab = el.dataset.homeTab;
      if (tab === "pins") {
        try {
          const suite = readConnectSuiteState();
          suite.workspaceTab = "saved";
          localStorage.setItem("lyfe.connect.suite.v1", JSON.stringify(suite));
        } catch (error) { /* Connect still opens with its normal workspace state */ }
        location.href = "connect.html#plans";
      } else if (tab === "projects") {
        setView("projects");
      } else if (tab === "pending") {
        state.taskStatusFilter = "open";
        setView("tasks");
      }
      break;
    }

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
    case "new-calm": {
      const previous = state.calmIndex;
      do state.calmIndex = Math.floor(Math.random() * 100000);
      while (state.calmIndex === previous);
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
        d.aeroThreads.forEach(thread => { if (thread.projectId === id) thread.projectId = null; });
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

    /* Aero */
    case "aero-from-source": {
      const source = ["today", "tracking", "library", "connect", "gmail", "profile"].includes(el.dataset.source)
        ? el.dataset.source : topSectionOf(state.view);
      let activeObject = null;
      let prompt = String(el.dataset.prompt || "").trim();
      if (source === "gmail" && id) {
        const message = gmailMessages.find(item => item.id === id);
        if (message) {
          activeObject = {
            type: "email", id: message.id, title: message.subject || "(no subject)",
            detail: message.sender + " · " + message.snippet,
          };
          if (!prompt) prompt = "what matters in this email, and what should i do next?";
        }
      }
      openAeroFrom(source, activeObject, prompt);
      break;
    }
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
    case "aero-new-thread":
      createAeroThread(null, "New conversation");
      state.aeroSourceView = "today";
      state.aeroObject = null;
      aeroDraftImages = [];
      setView("sol");
      break;
    case "aero-open-thread":
      if (switchAeroThread(id)) {
        aeroDraftImages = [];
        setView("sol");
      }
      break;
    case "aero-open-project": {
      const project = d.projects.find(item => item.id === id);
      if (!project) break;
      const existing = d.aeroThreads.filter(thread => thread.projectId === project.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      if (existing) switchAeroThread(existing.id);
      else createAeroThread(project.id, project.name);
      state.aeroSourceView = "tracking";
      state.aeroObject = { type: "project", id: project.id, title: project.name, detail: project.description || "Active project" };
      aeroDraftImages = [];
      setView("sol");
      break;
    }
    case "aero-add-image": {
      const input = document.getElementById("aero-image-input");
      if (input) input.click();
      break;
    }
    case "aero-remove-draft-image":
      aeroDraftImages = aeroDraftImages.filter(image => image.id !== id);
      render();
      break;
    case "aero-open-image": openAeroImage(id, el.dataset.img); break;
    case "aero-voice": toggleAeroVoice(); break;
    case "aero-listen": speakAeroMessage(id); break;
    case "aero-review-proposal": {
      const message = d.chat.find(item => item.id === id);
      aeroReviewProposalModal(message);
      break;
    }
    case "aero-notifications": aeroNotificationsModal(); break;
    case "aero-notification-open": {
      const attention = aeroAttentionState();
      const item = attention.notifications.find(notification => notification.id === id);
      const prompt = item ? String(item.prompt || "") : "";
      closeModal();
      setView("sol");
      const input = document.getElementById("sol-input");
      if (input && prompt) { input.value = prompt; input.focus(); input.setSelectionRange(prompt.length, prompt.length); }
      break;
    }
    case "sol-clear":
      confirmDialog("Clear this Aero conversation? Other project work stays in the Library.", () => {
        const thread = activeAeroThread();
        if (thread) {
          d.chat = d.chat.filter(message => message.threadId !== thread.id);
          thread.title = "New conversation";
          thread.updatedAt = Date.now();
        }
        save(); render();
      }, "Clear");
      break;
    case "aero-apply": {
      const message = d.chat.find(item => item.id === id);
      if (!message || !message.proposal || message.proposal.status !== "pending") break;
      if (aeroServerKind(message.proposal.actions) === "mixed") {
        aeroReviewProposalModal(message);
        break;
      }
      if (aeroServerEligible(message.proposal.actions)) {
        applyServerAeroProposal(id);
        break;
      }
      let applied = 0;
      let executionFailure = null;
      const runIndex = message.proposal.runId ? d.aeroRuns.findIndex(run => run.id === message.proposal.runId) : -1;
      if (runIndex >= 0 && window.AeroHarness) {
        const approved = AeroHarness.approve(d.aeroRuns[runIndex]);
        const result = AeroHarness.executeApproved(approved, {
          execute: action => applyAeroActionStep(action),
          audit: (step, execution) => auditAeroActionStep(step, execution),
          compensate: execution => compensateAeroActionStep(execution),
        });
        d.aeroRuns[runIndex] = result.run;
        applied = result.applied;
        executionFailure = result.run && result.run.failure ? result.run.failure : null;
      } else {
        applied = applyActions(message.proposal.actions);
      }
      message.proposal.status = applied ? "applied" : executionFailure ? "failed" : "cancelled";
      if (message.episodeId) observeAeroOutcome(message.episodeId, applied ? "accepted" : "rejected", { actionCount: applied, actionTypes: message.proposal.actions.map(action => action.type) });
      closeModal(); save(false, true); render();
      const rollbackFailed = executionFailure && executionFailure.code === "ROLLBACK_FAILED";
      toast(applied
        ? applied + " approved change" + (applied === 1 ? " applied" : "s applied")
        : rollbackFailed
          ? "Aero could not prove every change was restored. Review this run before continuing."
          : executionFailure
            ? "No change was kept. Aero stopped safely."
            : "No valid change to apply");
      break;
    }
    case "aero-cancel": {
      const message = d.chat.find(item => item.id === id);
      if (!message || !message.proposal || message.proposal.status !== "pending") break;
      if (aeroServerAuthority.has(id)) {
        cancelServerAeroProposal(id);
        break;
      }
      message.proposal.status = "cancelled";
      if (message.proposal.runId && window.AeroHarness) {
        const runIndex = d.aeroRuns.findIndex(run => run.id === message.proposal.runId);
        if (runIndex >= 0) d.aeroRuns[runIndex] = AeroHarness.cancel(d.aeroRuns[runIndex]);
      }
      if (message.episodeId) observeAeroOutcome(message.episodeId, "rejected", { actionCount: 0, actionTypes: message.proposal.actions.map(action => action.type) });
      closeModal(); save(false, true); render(); toast("No changes made");
      break;
    }
    case "aero-feedback": {
      const outcome = el.dataset.outcome === "helpful" ? "helpful" : "missed";
      observeAeroOutcome(id, outcome, { ratedAt: Date.now() });
      d.chat.forEach(item => { if (item.episodeId === id) item.feedback = outcome; });
      save(false, true); render(); toast(outcome === "helpful" ? "Aero learned from that success" : "Marked as a miss, no preference was learned");
      break;
    }
    case "aero-context": aeroContextModal(); break;
    case "aero-teach": aeroTeachModal(); break;
    case "aero-training-export": exportAeroTrainingExamples(); break;
    case "aero-forget":
      confirmDialog("Forget this Aero memory and its retained snapshots? The underlying Lyfe item, if any, is not deleted.", async () => {
        if (CLOUD_MODE && window.LyfeCloud && LyfeCloud.aeroMemoryEnabled) {
          await commitDirectAeroMemory(
            [{ type: "forget", query: id }],
            `aero-control-forget-${id}-${Date.now()}`,
            "Aero memory forgotten"
          );
          return;
        }
        d.aero = AeroCore.forgetMemory(d.aero, id);
        save(); render(); toast("Aero memory forgotten");
      }, "Forget");
      break;
    case "aero-reset":
      confirmDialog("Reset Aero's memories and adaptation history, including retained snapshots? Your tasks, notes, Connect data and chat stay intact.", async () => {
        if (CLOUD_MODE && window.LyfeCloud && LyfeCloud.aeroMemoryEnabled) {
          await commitDirectAeroMemory(
            [{ type: "reset" }],
            `aero-control-reset-${Date.now()}`,
            "Aero memory reset"
          );
          return;
        }
        d.aero = AeroCore.freshState();
        save(); closeModal(); render(); toast("Aero memory reset");
      }, "Reset Aero");
      break;
    case "aero-import-knowledge": {
      const input = document.getElementById("aero-knowledge-input");
      if (input) input.click();
      break;
    }
    case "aero-clear-knowledge":
      confirmDialog("Clear imported ChatGPT, Gemini, and file context from this device? Lyfe data and Aero memory stay intact.", async () => {
        if (window.AeroKnowledge) await AeroKnowledge.clear();
        closeModal(); settingsModal(); render(); toast("Knowledge vault cleared");
      }, "Clear vault");
      break;
    case "ollama-test": {
      const form = el.closest("form");
      const urlField = form && form.querySelector('[name="ollamaUrl"]');
      const modelField = form && form.querySelector('[name="ollamaModel"]');
      const base = String(urlField && urlField.value || "http://localhost:11434").replace(/\/+$/, "");
      const wanted = String(modelField && modelField.value || "qwen3:8b").trim();
      el.disabled = true; el.textContent = "Testing…";
      fetch(base + "/api/tags").then(response => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      }).then(data => {
        const names = (data.models || []).map(model => model.name || model.model);
        toast(names.some(name => name === wanted || String(name).startsWith(wanted + ":")) ? "Local model is ready" : "Ollama is running; pull " + wanted + " to use it");
      }).catch(() => toast("Ollama is not reachable on this device")).finally(() => {
        el.disabled = false; el.textContent = "Test local model";
      });
      break;
    }
    case "groq-test": {
      if (!(window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroGatewayEnabled)) {
        toast("Sign in to test the protected Groq route");
        break;
      }
      el.disabled = true; el.textContent = "Testing...";
      LyfeCloud.invokeAero({ prompt: "Reply with one short sentence confirming that Aero is ready.", date: todayStr(), kind: "general" })
        .then(response => {
          const model = response && response.model ? " · " + response.model : "";
          toast("Groq route is ready" + model);
        })
        .catch(error => toast(error && error.message ? error.message : "Groq route is unavailable"))
        .finally(() => { el.disabled = false; el.textContent = "Test Groq route"; });
      break;
    }

    case "gmail-connect":
      if (window.LyfeCloud && LyfeCloud.configured) {
        el.disabled = true;
        LyfeCloud.connectGmail().catch(error => {
          el.disabled = false;
          toast(error && error.message ? error.message : "Gmail could not connect - try again");
        });
      }
      else toast("Sign-in needs to be configured before Gmail can connect");
      break;
    case "gmail-refresh":
      gmailLoaded = false;
      gmailError = "";
      loadGmailInbox(true);
      break;
    case "gmail-scroll": {
      const track = document.getElementById("gmail-track");
      if (track) track.scrollBy({ left: Number(el.dataset.dir || 1) * Math.min(420, track.clientWidth * .82), behavior: "smooth" });
      break;
    }
    case "gmail-save": {
      const message = gmailMessages.find(item => item.id === id);
      if (!message) break;
      if (!d.saved.some(item => item.source === "Gmail" && item.sourceId === message.id)) {
        d.saved.unshift({ id: uid(), source: "Gmail", sourceId: message.id, kind: "email", title: message.subject || "(no subject)", body: message.sender + "\n\n" + message.snippet, savedAt: Date.now() });
        save();
        refreshGmailRail();
        toast("Email saved to Library");
      }
      break;
    }
    case "delete-saved":
      confirmDialog("Remove this saved item from your Library?", () => {
        d.saved = d.saved.filter(item => item.id !== id);
        save(); render(); toast("Saved item removed");
      }, "Remove");
      break;

    /* data & settings */
    case "export": doExport(); break;
    case "import": document.getElementById("importFile").click(); break;
    case "settings":
      settingsModal();
      refreshAeroPresenceStatus();
      break;
    case "aero-presence-enroll": {
      if (!(window.LyfeCloud && LyfeCloud.aeroPresenceEnabled && LyfeCloud.user)) {
        toast("Sign in before adding secure approval");
        break;
      }
      el.disabled = true;
      el.textContent = "Waiting for your device…";
      LyfeCloud.enrollAeroPresence().then(() => {
        aeroPresenceStatus = { loaded: false, loading: false, supported: true, enrolled: true, credentials: [] };
        settingsModal();
        refreshAeroPresenceStatus();
        toast("Device verification is on");
      }).catch(error => {
        el.disabled = false;
        el.textContent = "Add secure approval";
        toast(error && error.message ? error.message : "Secure approval setup failed");
      });
      break;
    }
    case "aero-presence-remove":
      confirmDialog("Remove device verification? Explicit Aero changes will return to review-click approval.", () => {
        LyfeCloud.removeAeroPresence().then(() => {
          aeroPresenceStatus = { loaded: true, loading: false, supported: true, enrolled: false, credentials: [] };
          settingsModal();
          toast("Device verification removed");
        }).catch(error => toast(error && error.message ? error.message : "Secure approval removal failed"));
      }, "Verify & remove");
      break;
    case "cmd-pick": cmdActivate(cmdItems[+el.dataset.i]); break;

    /* accounts */
    case "auth-google": {
      if (!(window.LyfeCloud && LyfeCloud.configured)) {
        setAuthError("Sign-in is still loading. Refresh the page once and try again.");
        toast("Sign-in is still loading");
        break;
      }
      const original = el.innerHTML;
      el.disabled = true;
      el.textContent = "Opening Google...";
      setAuthError("");
      LyfeCloud.signInGoogle().catch((error) => {
        el.disabled = false;
        el.innerHTML = original;
        const message = error && error.message ? error.message : "Google sign-in could not start. Try the email code instead.";
        setAuthError(message);
        toast(message);
      });
      break;
    }
    case "auth-change-email": {
      const emailForm = document.querySelector('[data-form="auth-email"]');
      const otpForm = document.querySelector('[data-form="auth-otp"]');
      if (emailForm) emailForm.hidden = false;
      if (otpForm) otpForm.hidden = true;
      setAuthError("");
      const field = emailForm && emailForm.querySelector('input[name="email"]');
      if (field) field.focus();
      break;
    }
    case "auth-guest": enterGuest(); break;
    case "sign-in-gate":
      if (window.LyfeCloud && LyfeCloud.configured) showAuthGate();
      else toast("Cloud sync is not configured on this site yet");
      break;
    case "onboard-focus":
      el.classList.toggle("sel");
      el.setAttribute("aria-pressed", el.classList.contains("sel") ? "true" : "false");
      sfxClick("chip");
      break;
    case "onboard-commit":
      document.querySelectorAll(".onb-segbtn").forEach(b => { b.classList.remove("sel"); b.setAttribute("aria-pressed", "false"); });
      el.classList.add("sel"); el.setAttribute("aria-pressed", "true"); sfxClick("chip"); break;
    case "sign-in":
      closeModal();
      if (window.LyfeCloud && LyfeCloud.configured) showAuthGate();
      else toast("Cloud sign-in is not set up yet");
      break;
    case "sign-out":
      confirmDialog(
        "Sign out of this account on this device? Your data stays safe in the cloud.",
        () => { const done = () => location.reload(); (window.LyfeCloud ? LyfeCloud.signOut() : Promise.resolve()).then(done, done); },
        "Sign out"
      );
      break;
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
    case "auth-email": {
      const email = val("email");
      if (!(window.LyfeCloud && LyfeCloud.configured)) { toast("Email sign-in is not configured yet"); break; }
      const button = f.querySelector("button[type=submit]");
      if (button) { button.disabled = true; button.textContent = "Sending..."; }
      setAuthError("");
      LyfeCloud.signInEmail(email).then(() => {
        const otpForm = document.querySelector('[data-form="auth-otp"]');
        if (otpForm) {
          const emailField = otpForm.querySelector('input[name="email"]');
          if (emailField) emailField.value = email;
          otpForm.hidden = false;
          const tokenField = otpForm.querySelector('input[name="token"]');
          if (tokenField) tokenField.focus();
        }
        f.hidden = true;
        toast("A six-digit sign-in code is on its way");
      }).catch(error => {
        const message = error && error.message ? error.message : "Could not send the sign-in code";
        setAuthError(message);
        toast(message);
        if (button) { button.disabled = false; button.textContent = "Send sign-in code"; }
      });
      break;
    }
    case "auth-otp": {
      const email = val("email");
      const token = val("token");
      if (!(window.LyfeCloud && LyfeCloud.configured)) { toast("Email sign-in is not configured yet"); break; }
      const button = f.querySelector("button[type=submit]");
      if (button) { button.disabled = true; button.textContent = "Checking..."; }
      setAuthError("");
      LyfeCloud.verifyEmailOtp(email, token).then(() => enterCloud()).catch(error => {
        const message = error && error.message ? error.message : "That code could not be verified";
        setAuthError(message);
        toast(message);
        if (button) { button.disabled = false; button.textContent = "Verify code"; }
      });
      break;
    }

    case "sol": {
      const inp = document.getElementById("sol-input");
      const text = (inp ? inp.value : "").trim();
      const attachments = aeroDraftImages.slice();
      if (!text && !attachments.length) return;
      if (inp) { inp.value = ""; inp.focus(); }
      aeroDraftImages = [];
      const draft = document.querySelector(".aero-draft-images");
      if (draft) draft.remove();
      handleUserMessage(text, attachments);
      break;
    }

    case "aero-teach": {
      const claim = val("claim");
      if (!claim) return;
      d.aero = AeroCore.upsertMemory(d.aero, {
        claim,
        type: ["episodic", "semantic", "project", "procedural"].includes(val("memoryType")) ? val("memoryType") : "semantic",
        scope: val("scope") || "global",
        sourceMode: "explicit",
        status: "active",
        confidence: 1,
        evidence: ["Taught directly in Aero controls"],
        sourceRefs: [{ kind: "user-explicit", id: "aero-memory-controls", label: "Taught in Aero controls", at: Date.now() }],
      });
      save(); closeModal(); render(); toast("Aero learned one explicit memory");
      break;
    }

    case "cmdbar": {
      // Enter opens the highlighted result (defaults to first match / Ask Aero)
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
    case "profile": {
      d.settings.name = val("name").slice(0, 60);
      if (d.settings.name) d.settings.nameSet = true;
      d.settings.username = val("username").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
      d.settings.headline = val("headline").slice(0, 100);
      d.settings.city = val("city").slice(0, 70);
      d.settings.country = val("country").slice(0, 70);
      d.settings.website = val("website").slice(0, 200);
      d.settings.bio = val("bio").slice(0, 500);
      d.settings.profileInterests = val("interests").split(",").map(item => item.trim()).filter(Boolean).slice(0, 12);
      d.settings.connectSync = val("connectSync") === "yes";
      save();
      syncProfileToConnect();
      render();
      toast(d.settings.connectSync ? "Profile saved and synced to Connect" : "Profile saved in Lyfe");
      break;
    }

    case "settings": {
      d.settings.name = val("name");
      if (d.settings.name) d.settings.nameSet = true;
      d.settings.age = val("age");
      d.settings.country = val("country");
      d.settings.theme = ["auto", "light", "dark"].includes(val("theme")) ? val("theme") : "auto";
      d.settings.sound = val("sound") !== "off";
      d.settings.aeroProactiveMode = ["brief", "important", "quiet", "off"].includes(val("aeroProactiveMode")) ? val("aeroProactiveMode") : "brief";
      d.settings.aeroSources = {
        today: fd.has("source_today"),
        tracking: fd.has("source_tracking"),
        library: fd.has("source_library"),
        connect: fd.has("source_connect"),
        gmail: fd.has("source_gmail"),
        profile: fd.has("source_profile"),
        knowledge: fd.has("source_knowledge"),
      };
      d.settings.aeroLocalLearning = fd.has("aeroLocalLearning");
      d.settings.aeroTrainingConsent = fd.has("aeroTrainingConsent");
      d.settings.provider = ["auto", "ollama", "groq", "offline"].includes(val("provider")) ? val("provider") : "auto";
      d.settings.aeroCloudEnabled = fd.has("aeroCloudEnabled") || d.settings.provider === "groq";
      d.settings.ollamaUrl = val("ollamaUrl") || "http://localhost:11434";
      d.settings.ollamaModel = val("ollamaModel") || "qwen3:8b";
      brainWarned = false;
      groqWarned = false;
      groqDownUntil = 0;
      ollamaDown = false;   // give the newly-chosen brain a fresh try
      applyTheme();
      save(); closeModal(); render(); toast("Settings saved");
      break;
    }

    case "onboarding": submitOnboarding(fd); break;
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
  } else if (el.id === "aero-image-input") {
    const files = Array.from(el.files || []);
    el.value = "";
    addAeroImages(files);
  } else if (el.id === "aero-project-select") {
    const thread = activeAeroThread();
    if (!thread) return;
    thread.projectId = el.value || null;
    thread.updatedAt = Date.now();
    const project = thread.projectId && state.data.projects.find(item => item.id === thread.projectId);
    state.aeroSourceView = project ? "tracking" : "today";
    state.aeroObject = project ? { type: "project", id: project.id, title: project.name, detail: project.description || "Active project" } : null;
    save(); render(); toast(project ? "Conversation linked to " + project.name : "Conversation moved to General");
  } else if (el.id === "aero-knowledge-input") {
    const files = Array.from(el.files || []);
    el.value = "";
    if (!window.AeroKnowledge || !files || !files.length) return;
    toast("Importing on this device…");
    AeroKnowledge.importFiles(files).then(result => {
      closeModal(); settingsModal(); render();
      toast(result.imported + " knowledge record" + (result.imported === 1 ? "" : "s") + " ready");
    }).catch(error => toast(error && error.message ? error.message : "That import could not be read"));
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
  } else if (el.id === "sol-input") {
    el.style.height = "auto";
    el.style.height = Math.min(150, el.scrollHeight) + "px";
  } else if (el.matches && el.matches('input[type="range"][data-out]')) {
    const out = document.getElementById(el.dataset.out);
    if (out) out.textContent = el.value + "%";
  }
});

/* universal command bar: search everything, jump anywhere, or ask Aero */
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
  out.push({ type: "sol", query: qRaw.trim(), label: 'Ask Aero: "' + qRaw.trim() + '"', sub: "chat with your companion", ic: "sol" });
  return out.slice(0, 14);
}

function cmdResultsHtml(q) {
  cmdItems = cmdSearch(q);
  cmdSel = 0;
  if (!cmdItems.length) return `<div class="cmd-empty">no matches. press Enter to ask Aero.</div>`;
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
    `<div class="modal-head"><h3>Search · jump · ask Aero</h3></div>
     <form data-form="cmdbar" autocomplete="off">
       <input type="text" id="cmd-input" maxlength="2000" autocomplete="off"
         placeholder="search anything, or 'remind me to…', or ask Aero a question">
     </form>
     <div id="cmd-results" class="cmd-results">${cmdResultsHtml("")}</div>
     <p class="fld-note cmd-hint">↑↓ to move · Enter to open · Esc to close</p>`
  );
}

document.addEventListener("keydown", (e) => {
  if (e.target && e.target.id === "sol-input" && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    const form = e.target.closest("form");
    if (form) form.requestSubmit();
    return;
  }
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  const activeDialog = dialogs.find(el => !el.hidden && getComputedStyle(el).display !== "none");
  if (e.key === "Tab" && activeDialog) {
    const focusable = Array.from(activeDialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(el => getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
    if (focusable.length) {
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return; }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); return; }
    }
  }
  const actionRole = e.target.closest && e.target.closest('[role="button"][data-action]');
  if (actionRole && actionRole.tagName !== "BUTTON" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    actionRole.click();
    return;
  }
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
  // the Wander card lives on Today; ← → flips places when focus is not in a field
  if (state.view === "today" && (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
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
  if (ROUTE_VIEWS.includes(v) && resolvedViewId(v) !== state.view) setView(v);
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
  try { obj = JSON.parse(localStorage.getItem(ACTIVE_KEY)); }
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

function connectDigest() {
  const connect = readConnectState() || {};
  const notes = Array.isArray(connect.notifications) ? connect.notifications : [];
  return [notes.length, notes[0] && notes[0].id || "", notes.filter(item => !item.read).length,
    Array.isArray(connect.saved) ? connect.saved.length : 0,
    Array.isArray(connect.conversations) ? connect.conversations.length : 0].join(":");
}
let connectUiDigest = connectDigest();

window.addEventListener("storage", (e) => {
  if (e.key === ACTIVE_KEY && revOfRaw(e.newValue) > (state.data.rev || 0)) absorbStored();
  if (e.key === "lyfe.connect.preview.v1") {
    connectUiDigest = connectDigest();
    if (state.view === "today") render(); else renderNav();
  }
});

/* storage events can be missed while a tab is frozen or in the back/forward
   cache - re-check whenever it comes back to life */
function syncFromStorage() {
  if (storedRev() > (state.data.rev || 0)) absorbStored();
  const nextConnectDigest = connectDigest();
  if (nextConnectDigest !== connectUiDigest) {
    connectUiDigest = nextConnectDigest;
    if (state.view === "today") render(); else renderNav();
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncFromStorage(); });
window.addEventListener("pageshow", (e) => { if (e.persisted) syncFromStorage(); });

/* ---------------- boot + auth ---------------- */

/* The app can start in three ways, decided by resolveAuthAndBoot():
   - guest  : local-only, exactly as Lyfe has always worked
   - cloud  : signed in, data synced to the user's own row in Supabase
   - gate   : configured but signed out, show the login screen and wait
   When cloud is not configured at all, it silently runs guest, so the
   app never breaks while the backend is half set up. */

function maybeOfferConnectPlan() {
  const params = new URLSearchParams(location.search);
  const title = String(params.get("connectPlan") || "").trim().slice(0, 200);
  if (!title) return;
  const note = String(params.get("connectNote") || "").trim().slice(0, 500);

  // Remove the handoff immediately so a refresh cannot offer the same plan
  // twice. Nothing enters Lyfe until the person confirms in the modal.
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
  setTimeout(() => {
    confirmDialog(
      "Add \"" + title + "\" to your Lyfe tasks? Only this title and the note you approved in Connect will be copied.",
      () => {
        state.data.tasks.push({
          id: uid(),
          title,
          area: "Personal",
          priority: "Medium",
          due: null,
          dueTime: "",
          important: false,
          projectId: null,
          notes: note,
          status: "open",
          createdAt: Date.now(),
          completedAt: null,
          alarmAck: false,
        });
        save();
        setView("tasks");
        toast("Connect plan added to Lyfe");
      },
      "Add plan"
    );
  }, 120);
}

let booted = false;
let gateReturnFocus = null;
function setAuthError(message) {
  const el = document.querySelector("[data-auth-error]");
  if (!el) return;
  el.textContent = String(message || "");
  el.hidden = !message;
}
function bootApp() {
  if (booted) return;   // sign-out reloads the page, so boot runs once per load
  booted = true;
  let launchPrompt = "";
  try {
    const launch = JSON.parse(sessionStorage.getItem("lyfe.aero.launch") || "null");
    sessionStorage.removeItem("lyfe.aero.launch");
    if (launch && Date.now() - Number(launch.ts || 0) < 30 * 60 * 1000) {
      const allowedSources = ["today", "tracking", "library", "connect", "gmail", "profile"];
      state.aeroSourceView = allowedSources.includes(launch.source) ? launch.source : "today";
      launchPrompt = String(launch.prompt || "").slice(0, 4000);
      state.view = "sol";
    }
  } catch (error) { /* launch handoff is optional */ }
  try {
    if (!localStorage.getItem(ACTIVE_KEY)) save();
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
  if (launchPrompt) {
    const input = document.getElementById("sol-input");
    if (input) {
      input.value = launchPrompt;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
  if (window.LyfeCloud && LyfeCloud.gmailToken) loadGmailInbox(false);
  maybeOfferConnectPlan();
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
}

function showAuthGate() {
  const el = document.getElementById("auth-gate");
  gateReturnFocus = document.activeElement;
  if (el) {
    setAuthError(window.LyfeCloud && LyfeCloud.lastError ? LyfeCloud.lastError : "");
    const google = el.querySelector('[data-action="auth-google"]');
    const divider = el.querySelector(".auth-or");
    if (google) google.hidden = false;
    if (divider) divider.hidden = false;
    el.hidden = false;
    setTimeout(() => {
      const first = el.querySelector("button:not([disabled])");
      if (first) first.focus();
    }, 0);
  }
  document.body.classList.add("gated");
}
function hideAuthGate() {
  const returnTo = gateReturnFocus;
  gateReturnFocus = null;
  const el = document.getElementById("auth-gate");
  if (el) el.hidden = true;
  document.body.classList.remove("gated");
  if (booted) setTimeout(() => { if (returnTo && returnTo.isConnected) returnTo.focus(); }, 0);
}

/* ---- onboarding: collect who they are, once, after first Google sign-in ---- */

const FOCUS_OPTIONS = [
  "Build discipline", "Track my work", "Learn new skills", "Health and habits",
  "Beat procrastination", "Ship big projects", "Just get organised",
];
const COMMIT_OPTIONS = [
  ["exploring", "Just exploring"],
  ["committed", "Committed"],
  ["all-in", "All in"],
];
const COMMON_COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "India", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Ireland", "Portugal", "Sweden",
  "Norway", "Denmark", "Finland", "Poland", "Switzerland", "Austria", "Belgium",
  "Brazil", "Mexico", "Argentina", "Chile", "Colombia", "Japan", "South Korea",
  "China", "Singapore", "Malaysia", "Indonesia", "Philippines", "Thailand",
  "Vietnam", "United Arab Emirates", "Saudi Arabia", "Israel", "Turkey", "Egypt",
  "South Africa", "Nigeria", "Kenya", "New Zealand", "Pakistan", "Bangladesh",
];

function lyfeAuthMark() {
  return `<span class="auth-mark" aria-hidden="true"><img src="../assets/lyfe_logo.svg" alt=""></span>`;
}

function showOnboarding() {
  const el = document.getElementById("onboard-gate");
  if (!el) { bootApp(); return; }   // failsafe: never trap the user out of the app
  const s = state.data.settings;
  const suggestedName = s.name || (window.LyfeCloud && LyfeCloud.user ? LyfeCloud.user.name : "") || "";
  el.innerHTML =
    `<div class="onb-shell">
      <aside class="onb-story">
        <div class="onb-brand"><img src="../assets/lyfe_logo.svg" alt=""><span>Lyfe</span></div>
        <div class="onb-story-main">
          <span class="onb-kicker">YOUR SPACE, YOUR DEFAULTS</span>
          <h2>Start with what matters.</h2>
          <p>Give Lyfe a little direction now. Aero can make the rest feel lighter from day one.</p>
          <div class="onb-story-points">
            <div><b>01</b><span><strong>Personal from the start</strong><small>Your priorities shape what Lyfe surfaces.</small></span></div>
            <div><b>02</b><span><strong>Always adjustable</strong><small>Change any answer later in Settings.</small></span></div>
          </div>
        </div>
        <p class="onb-privacy">Private to your Lyfe account.</p>
      </aside>
      <section class="onb-card" aria-labelledby="onb-title">
        <div class="onb-head">
          <div class="onb-head-top">
            ${lyfeAuthMark()}
            <span class="onb-step">ONE-TIME SETUP</span>
          </div>
          <h1 class="onb-title" id="onb-title">Make Lyfe yours</h1>
          <p class="onb-sub">A few private details. Change them anytime.</p>
        </div>
        <form data-form="onboarding" class="onb-form" autocomplete="off">
          <div class="onb-row">
            ${fld("Your name", `<input type="text" name="name" maxlength="60" required value="${esc(suggestedName)}" placeholder="What should we call you?" autocomplete="name">`)}
            ${fld("Age", `<input type="number" name="age" min="1" max="120" value="${esc(s.age || "")}" placeholder="e.g. 20" inputmode="numeric">`)}
          </div>
          ${fld("Country", `<input type="text" name="country" maxlength="56" value="${esc(s.country || "")}" placeholder="Where are you?" list="onb-countries" autocomplete="country-name">
            <datalist id="onb-countries">${COMMON_COUNTRIES.map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist>`)}
          <div class="onb-group">
            <span class="onb-label" id="onb-focus-label">What matters right now? <small>Select any that fit</small></span>
            <div class="onb-chips" role="group" aria-labelledby="onb-focus-label">${FOCUS_OPTIONS.map(g =>
              `<button type="button" class="onb-chip${(s.focus || []).includes(g) ? " sel" : ""}" data-action="onboard-focus" data-v="${esc(g)}" aria-pressed="${(s.focus || []).includes(g)}">${esc(g)}</button>`).join("")}</div>
          </div>
          <div class="onb-group">
            <span class="onb-label" id="onb-commit-label">Choose your pace</span>
            <div class="onb-seg" role="group" aria-labelledby="onb-commit-label">${COMMIT_OPTIONS.map(([v, l]) =>
              `<button type="button" class="onb-segbtn${s.commitment === v ? " sel" : ""}" data-action="onboard-commit" data-v="${v}" aria-pressed="${s.commitment === v}">${esc(l)}</button>`).join("")}</div>
          </div>
          <button type="submit" class="auth-btn onb-submit">Enter Lyfe</button>
        </form>
      </section>
    </div>`;
  el.hidden = false;
  document.body.classList.add("gated");   // reuse the gate's app-hiding
  setTimeout(() => { const i = el.querySelector('input[name="name"]'); if (i) i.focus(); }, 30);
}

function hideOnboarding() {
  const el = document.getElementById("onboard-gate");
  if (el) { el.hidden = true; el.innerHTML = ""; }
  document.body.classList.remove("gated");
}

function submitOnboarding(fd) {
  const val = k => String(fd.get(k) == null ? "" : fd.get(k)).trim();
  const name = val("name");
  if (!name) { toast("A name helps Aero talk to you"); return; }
  const s = state.data.settings;
  s.name = name;
  s.nameSet = true;
  s.age = val("age");
  s.country = val("country");
  s.focus = [...document.querySelectorAll(".onb-chip.sel")].map(b => b.dataset.v);
  const commit = document.querySelector(".onb-segbtn.sel");
  s.commitment = commit ? commit.dataset.v : "";
  s.onboarded = true;
  save();
  hideOnboarding();
  applyTheme();
  bootApp();
  toast("Welcome, " + name.split(/\s+/)[0]);
}

function enterGuest() {
  if (booted) { hideAuthGate(); return; }   // opened the gate mid-session: just close it
  CLOUD_MODE = false;
  aeroMemoryAuthorityError = "";
  ACTIVE_KEY = STORAGE_KEY;
  document.body.classList.remove("signed-in");
  state.data = loadData();
  hideAuthGate();
  const vault = window.AeroKnowledge ? AeroKnowledge.setOwner("guest") : Promise.resolve();
  Promise.resolve(vault).finally(bootApp);
}

async function refreshAuthoritativeAeroMemory(renderAfter) {
  if (!(CLOUD_MODE && window.LyfeCloud && LyfeCloud.user && LyfeCloud.aeroMemoryEnabled && window.AeroCore)) return false;
  const cached = AeroCore.normalize(state.data.aero);
  const pendingEpisodes = cached.episodes.filter(episode => episode.outcome === "pending");
  try {
    const result = await LyfeCloud.readAeroMemory();
    if (!(result && result.state)) throw new Error("Authoritative memory was unavailable.");
    const authoritative = AeroCore.normalize(result.state);
    if (authoritative.memoryRevision < cached.memoryRevision) return false;
    const authoritativeEpisodeIds = new Set(authoritative.episodes.map(episode => episode.id));
    authoritative.episodes = authoritative.episodes.concat(
      pendingEpisodes.filter(episode => !authoritativeEpisodeIds.has(episode.id))
    ).sort((left, right) => left.createdAt - right.createdAt).slice(-500);
    state.data.aero = authoritative;
    aeroMemoryAuthorityError = "";
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.data)); } catch (_) { /* in-memory authority still holds */ }
    if (renderAfter && booted) render();
    return true;
  } catch (error) {
    // A signed-in cache is never promoted to authority. If the private server
    // cannot be verified, remove cached memories from prompt context until a
    // later authoritative read succeeds.
    const quarantined = AeroCore.freshState();
    quarantined.episodes = pendingEpisodes.slice(-500);
    state.data.aero = quarantined;
    aeroMemoryAuthorityError = error && error.code ? String(error.code) : "memory_unavailable";
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.data)); } catch (_) { /* fail closed in memory */ }
    if (renderAfter && booted) render();
    return false;
  }
}

/* signed in: pull the account's data (or seed it from this device on first
   login), cache it locally for offline, then run */
async function enterCloud() {
  CLOUD_MODE = true;
  document.body.classList.add("signed-in");
  ACTIVE_KEY = "lyfe.cloud." + LyfeCloud.user.id;
  if (window.AeroKnowledge) await AeroKnowledge.setOwner(LyfeCloud.user.id);
  let cloud = null;
  try { cloud = await LyfeCloud.pull(); } catch (e) { cloud = null; }

  if (cloud && cloud.data) {
    state.data = normalize(cloud.data);
    state.data.rev = Math.max(state.data.rev || 0, cloud.rev || 0);
    state.cloudRev = Number(cloud.rev || 0);
  } else {
    // brand-new account: start on a clean, empty slate. No demo content and no
    // leftover guest data, so a fresh login never shows data that isn't yours.
    state.data = defaultData();
    const firstRev = 1;
    state.data.rev = firstRev;
    try {
      const created = await LyfeCloud.push(state.data, firstRev);
      if (created && created.data) {
        state.data = normalize(created.data);
        state.data.rev = Number(created.rev || firstRev);
        state.cloudRev = Number(created.rev || firstRev);
      }
    } catch (e) {
      // Keep the next offline save eligible to create revision one.
      state.data.rev = 0;
    }
  }

  // Signed-in memory is server-owned. The Lyfe document keeps only a cache so
  // a stale tab cannot quietly become the source of truth.
  await refreshAuthoritativeAeroMemory(false);

  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.data)); } catch (e) {}

  LyfeCloud.subscribe(onCloudRemote);
  hideAuthGate();
  // seed the name from the Google profile so onboarding is prefilled
  if (!state.data.settings.name && LyfeCloud.user && LyfeCloud.user.name) {
    state.data.settings.name = LyfeCloud.user.name;
  }
  // first time on this account: collect their details before opening the app
  if (!state.data.settings.onboarded) { showOnboarding(); return; }
  bootApp();
}

/* another device wrote a newer revision - fold it in like a cross-tab change */
function onCloudRemote(payload, force) {
  if (!payload) return;
  const incomingRev = Number(payload.rev || 0);
  const knownCloudRev = Number(state.cloudRev || 0);
  if (force ? incomingRev < knownCloudRev : incomingRev <= knownCloudRev) return;
  state.cloudRev = incomingRev;
  state.data = normalize(payload.data);
  state.data.rev = incomingRev;
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.data)); } catch (e) {}
  if (state.noteId && !state.data.notes.some(n => n.id === state.noteId)) state.noteId = null;
  if (state.docId && !state.data.docs.some(n => n.id === state.docId)) state.docId = null;
  applyTheme();
  const ae = document.activeElement;
  const typing = ae && (ae.id === "pad-title" || ae.id === "pad-body");
  if (!typing) render();
  refreshAuthoritativeAeroMemory(!typing);
}

window.addEventListener("lyfe:cloudconflict", event => {
  const payload = event && event.detail;
  if (!payload) return;
  onCloudRemote(payload, true);
  toast("Lyfe changed in another signed-in session. The current account version was kept.");
});

async function resolveAuthAndBoot() {
  if (!window.LyfeCloud) { enterGuest(); return; }   // module blocked: never break
  let status = "unconfigured";
  try { status = await LyfeCloud.init(); } catch (e) { status = "unconfigured"; }
  if (status === "cloud") { await enterCloud(); }
  else if (status === "gate") { showAuthGate(); }
  else { enterGuest(); }                              // unconfigured: local as today
}

(function init() {
  applyTheme();
  const launchParams = new URLSearchParams(location.search);
  const aeroFrom = launchParams.get("aeroFrom");
  if (["today", "tracking", "library", "connect", "gmail", "profile"].includes(aeroFrom)) state.aeroSourceView = aeroFrom;
  const h = location.hash.replace(/^#\//, "");
  if (ROUTE_VIEWS.includes(h)) {
    state.view = resolvedViewId(h);
    if (TRACKING_VIEWS.includes(state.view)) state.trackingView = state.view;
    if (LIBRARY_VIEWS.includes(state.view)) state.libraryView = state.view;
    if (PROFILE_VIEWS.includes(state.view)) state.profileView = state.view;
  }
  // hide the app shell up front only when a backend exists, so a signed-in
  // user never flashes an empty app and a signed-out user never flashes it
  // before the login screen. Unconfigured installs skip this entirely.
  if (window.LyfeCloud && LyfeCloud.configured) document.body.classList.add("gated");
  resolveAuthAndBoot();
})();
