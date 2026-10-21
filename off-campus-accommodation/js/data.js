/* ---------- Storage helpers (localStorage, so data survives refresh) ---------- */
const DB = {
  get(key, fallback) {
    try { const v = localStorage.getItem('cn_' + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('cn_' + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
};

/* ---------- Generated house "photos" (inline SVG, no image files needed) ---------- */
function photo(hue, variant) {
  variant = variant || 0;
  const wall = `hsl(${(hue + variant * 24) % 360} 38% ${72 - variant * 3}%)`;
  const roof = `hsl(${(hue + 190) % 360} 30% ${32 + variant * 4}%)`;
  const door = `hsl(${(hue + 30) % 360} 45% 30%)`;
  const sunX = 70 + variant * 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${(hue + 150) % 360} 60% 84%)"/><stop offset="1" stop-color="#fdf6e3"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#s)"/>
  <circle cx="${sunX}" cy="52" r="24" fill="#f6c453"/>
  <rect y="196" width="400" height="64" fill="hsl(${(hue + 95) % 360} 32% 56%)"/>
  <rect x="${110 - variant * 12}" y="104" width="${190 + variant * 12}" height="98" fill="${wall}"/>
  <polygon points="${96 - variant * 12},108 ${205 + variant * 0},50 ${314 + variant * 0},108" fill="${roof}"/>
  <rect x="${186 + variant * 4}" y="140" width="34" height="62" rx="3" fill="${door}"/>
  <rect x="${128 - variant * 8}" y="128" width="38" height="34" rx="3" fill="#fff8e6" stroke="${roof}" stroke-width="3"/>
  <rect x="${246 + variant * 4}" y="128" width="38" height="34" rx="3" fill="#fff8e6" stroke="${roof}" stroke-width="3"/>
  <rect x="330" y="150" width="8" height="48" fill="hsl(30 30% 30%)"/>
  <circle cx="334" cy="140" r="24" fill="hsl(${(hue + 100) % 360} 40% 38%)"/>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------- Seed data (first run only) ---------- */
const SEED_USERS = [
  { id: 'u1', role: 'landlord', name: 'Mrs. Chanda Mwila', email: 'chanda@demo.com', password: 'demo123', phone: '+260 977 123 456', since: 'March 2022', about: 'I have rented rooms to students near the campus gate for over ten years. Rooms are clean, quiet and safe, and water and security are always included.', rating: 4.8, reviews: 23, verified: true },
  { id: 'u2', role: 'landlord', name: 'Mr. Joseph Banda', email: 'joseph@demo.com', password: 'demo123', phone: '+260 966 234 567', since: 'August 2023', about: 'Self-contained rooms with reliable WiFi, aimed at final-year students who need a quiet place to study.', rating: 4.5, reviews: 11, verified: true },
  { id: 'u3', role: 'landlord', name: 'Mrs. Mutale Phiri', email: 'mutale@demo.com', password: 'demo123', phone: '+260 955 345 678', since: 'January 2024', about: 'Family-run boarding house with a shared kitchen and a garden. Female students preferred.', rating: 4.2, reviews: 6, verified: false },
  { id: 'u4', role: 'tenant', name: 'Demo Student', email: 'student@demo.com', password: 'demo123', phone: '+260 971 000 111' }
];

const SEED_LISTINGS = [
  { id: 'l1', ownerId: 'u1', title: 'Gate View Boarding House', location: 'Next to main gate', distance: 0.4, price: 850, deposit: 850, bedrooms: 2, bathrooms: 1, perRoom: 2, selfContained: false, available: true, availableFrom: '2026-10-15', utilities: ['Water', 'WiFi'], amenities: ['Security', 'Kitchen'], description: 'Two-bedroom shared house a five-minute walk from the main gate. Shared kitchen and bathroom, with a night guard.', hue: 20, mapX: 330, mapY: 190 },
  { id: 'l2', ownerId: 'u2', title: 'Scholars Self-Contained', location: 'Riverside Estate', distance: 1.2, price: 1400, deposit: 1400, bedrooms: 1, bathrooms: 1, perRoom: 1, selfContained: true, available: true, availableFrom: '2026-10-20', utilities: ['Water', 'WiFi', 'Electricity'], amenities: ['Furnished', 'Parking', 'Security'], description: 'Private self-contained room with its own bathroom and kitchenette. Fast WiFi, desk and a quiet street.', hue: 160, mapX: 420, mapY: 300 },
  { id: 'l3', ownerId: 'u1', title: 'Mwila Annex', location: 'Chimwemwe Road', distance: 0.8, price: 650, deposit: 650, bedrooms: 3, bathrooms: 2, perRoom: 3, selfContained: false, available: false, availableFrom: '2026-12-01', utilities: ['Water'], amenities: ['Kitchen'], description: 'Budget rooms for three students each. Currently full; next vacancy opens in December.', hue: 330, mapX: 215, mapY: 250 },
  { id: 'l4', ownerId: 'u3', title: 'Garden Lodge', location: 'Kabwe Road', distance: 2.1, price: 700, deposit: 700, bedrooms: 4, bathrooms: 2, perRoom: 2, selfContained: false, available: true, availableFrom: '2026-10-12', utilities: ['Water', 'Electricity'], amenities: ['Kitchen', 'Security'], description: 'Family-run lodge with a garden and shared kitchen. Taxi stop at the corner.', hue: 100, mapX: 120, mapY: 120 },
  { id: 'l5', ownerId: 'u2', title: 'Hilltop Studio Rooms', location: 'Hillside', distance: 1.6, price: 1100, deposit: 1100, bedrooms: 1, bathrooms: 1, perRoom: 1, selfContained: true, available: true, availableFrom: '2026-11-01', utilities: ['Water', 'WiFi'], amenities: ['Furnished', 'Security'], description: 'Compact furnished studio with a view over the campus. Single occupancy only.', hue: 250, mapX: 470, mapY: 110 },
  { id: 'l6', ownerId: 'u3', title: 'Unity Shared House', location: 'Unity Compound', distance: 0.6, price: 500, deposit: 500, bedrooms: 3, bathrooms: 1, perRoom: 4, selfContained: false, available: true, availableFrom: '2026-10-10', utilities: ['Water'], amenities: ['Kitchen'], description: 'The most affordable option near campus. Four students share a room; kitchen is shared.', hue: 45, mapX: 255, mapY: 140 }
];

function initData() {
  if (!DB.get('seeded', false)) {
    DB.set('users', SEED_USERS);
    DB.set('listings', SEED_LISTINGS);
    DB.set('requests', []);
    DB.set('saved', {});
    DB.set('seeded', true);
  }
}
initData();
