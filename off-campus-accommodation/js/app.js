/* =====================================================================
   Off Campus Accommodation – off-campus housing app (front-end prototype)
   ---------------------------------------------------------------------
   HOW THE APP IS ORGANISED (read top to bottom):
     1. IMAGES block ........ the picture files used for backgrounds/photos
     2. Helpers ............. small utility functions used everywhere
     3. State + admin seed .. variables the app remembers + the admin account
     4. Layout pieces ....... the page frame (top bar) and listing card
     5. Auth screens ........ choose role, register, login
     6. Tenant screens ...... home, saved, my requests, listing, owner, map
     7. Landlord screens .... dashboard, requests, add/edit listing
     8. Admin screen ........ remove landlords/tenants/listings, add admins
     9. Modals .............. pop-up boxes (contact, request a space)
    10. Actions ............. what happens when a button is clicked
    11. Form submissions .... register, login, listings, requests, add admin
    12. Router .............. decides which screen to show for each URL

   SCREEN FLOW (matches the wireframes):
     Choose role > Register / Login > Home > Listing details >
     Owner profile > Map.   Landlords get their own dashboard.
     The admin gets an Admin panel.

   NOTE: This file expects another script (loaded before it) to define
   `DB` – a tiny wrapper around localStorage with DB.get(key, default)
   and DB.set(key, value). All data is stored in the browser.
   ===================================================================== */

/* =====================================================================
   1. >>> YOUR IMAGES – EDIT ONLY THIS BLOCK <<<
   Put your picture files in the "image" folder (next to index.html)
   and type their file names below. Names are case-sensitive.
   ===================================================================== */
const IMAGES = {
  /* ----- BACKGROUNDS (full-screen, behind the white form card) ----- */
  roleBackground:     'image/campusnest-login-background.png',   // "Join as a Tenant / Landlord" screen
  registerBackground:'image/campusnest-login-background.png',   // Register screen
  loginBackground:    'image/campusnest-login-background.png',   // Login screen

  /* ----- BANNERS (wide picture behind the page heading) ----- */
  homeBanner:         'image/sunlit-student-dorm-retreat.png',   // Tenant home page, "Welcome, name" area
  dashboardBanner:    'image/sunlit-student-dorm-retreat.png"',   // Landlord dashboard, "Welcome, name" area

  /* ----- LISTING PICTURES ----- */
  // Used when a landlord does not upload their own photo.
  // Add as many as you like (4 or more is best). Each listing picks from this list.
  listingPhotos: [
    'image/backG.jpg',
    'image/house1.jpg',
    'image/house2.jpg',
    'image/house3.jpg',
    'image/house4.jpg'
  ]
};

/* The name shown in the logo and headings. Change it here to rename the app. */
const APP_NAME = 'Off Campus Accommodation';

/* max number of photos a landlord can add to one listing */
const MAX_PHOTOS = 5;

/* darkness of the overlay on backgrounds/banners: 0 = none, 1 = black */
const OVERLAY = 0.75;   // 0.75 keeps white text at 4.5:1 contrast even on a light photo

/* ===================================================================== */

/* The three empty containers in index.html that this script fills in:
   #app        – the whole page content
   #toast      – the small message that pops up ("Saved to your list")
   #modal-root – the pop-up boxes (dialogs) */
const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const $modal = document.getElementById('modal-root');

/* =====================================================================
   2. HELPERS
   ===================================================================== */

/* esc(): makes user-typed text safe to put inside HTML, so someone typing
   <script> in a name or description cannot break or hack the page. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* K(): formats a number as Kwacha, e.g. 1500 -> "K 1,500" */
const K = n => 'K ' + Number(n || 0).toLocaleString('en-US');

/* initials(): "Mrs. Chanda Banda" -> "CB" (used for the round avatar) */
const initials = n => String(n).replace(/^(Mrs?\.|Dr\.|Ms\.)\s*/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* fmtDate(): "2026-10-10" -> "10 Oct 2026" (shows "—" if empty) */
const fmtDate = d => { if (!d) return '—'; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };

/* uid(): makes a random id with a prefix, e.g. uid('u') -> "u4k2j9x1a" */
const uid = p => p + Math.random().toString(36).slice(2, 9);

/* Shortcuts to read saved data from the browser storage (via DB) */
const users = () => DB.get('users', []);            // everyone: tenants, landlords, admins
const listings = () => DB.get('listings', []);      // all boarding-house listings
const requests = () => DB.get('requests', []);      // "request a space" messages
const ratings = () => DB.get('ratings', []);        // tenant reviews of landlords
const userById = id => users().find(u => u.id === id);
const listingById = id => listings().find(l => l.id === id);

/* ratingOf(): a landlord's average stars = the starting rating plus the
   reviews students leave in the app. */
function ratingOf(o) {
  const rs = ratings().filter(r => r.landlordId === o.id);
  const base = o.reviews || 0, n = base + rs.length;
  const sum = (o.rating || 0) * base + rs.reduce((a, r) => a + r.stars, 0);
  return { avg: n ? Math.round(sum / n * 10) / 10 : 0, count: n };
}

/* waLink(): builds a WhatsApp chat link from a phone number (0977... becomes 260977...) */
function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '260' + d.slice(1);
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
}

/* me(): the user who is logged in right now (undefined if nobody) */
const me = () => userById(DB.get('session', null));

/* savedIds(): ids of the listings the logged-in tenant has hearted */
const savedIds = () => (DB.get('saved', {})[DB.get('session', '')] || []);

/* pickPhoto(): picks one picture from IMAGES.listingPhotos.
   The same listing (same "seed") always gets the same picture. */
const pickPhoto = (seed, n) => {
  const list = IMAGES.listingPhotos;
  return list[(Math.abs(Math.round(Number(seed) || 0)) + n) % list.length];
};

/* imgs(): the 4 pictures of a listing: [main, thumb1, thumb2, thumb3].
   If the landlord uploaded a photo (l.img) it is used as the main one. */
const imgs = l => (l.images && l.images.length) ? l.images.slice(0, MAX_PHOTOS)
  : [l.img || pickPhoto(l.hue, 0), pickPhoto(l.hue, 1), pickPhoto(l.hue, 2), pickPhoto(l.hue, 3)];

/* bg(): builds the CSS for a background picture with a dark teal overlay
   on top so white text stays readable. */
const bg = (url, extra) => `background:linear-gradient(rgba(15,76,92,${OVERLAY}),rgba(15,76,92,${OVERLAY})),url('${url}') center/cover no-repeat${extra || ''};background-color:#0f4c5c;`;

/* toast(): shows a small message at the bottom for about 2.6 seconds */
let toastTimer;
function toast(msg) {
  $toast.textContent = msg; $toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

/* go(): move to another screen. Screens are chosen by the part of the
   URL after "#", e.g. "#/home". If we are already there, just redraw. */
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

/* If a picture file is missing, show a generated house picture instead
   of a broken-image icon. */
let fbCount = 0;
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && !t.dataset.fb) { t.dataset.fb = '1'; t.src = photo(40 + (fbCount++ % 6) * 55, fbCount % 3); }
}, true);

/* ICON: small SVG pictures (logo and role icons) kept as text */
const ICON = {
  logo: '<svg viewBox="0 0 32 32" fill="none"><path d="M3 15 16 4l13 11" stroke="#0f4c5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14v12h18V14" stroke="#0f4c5c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="18" width="6" height="8" rx="1" fill="#f2b134"/></svg>',
  tenant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  landlord: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-7h6v7"/></svg>'
};

/* =====================================================================
   3. STATE + ADMIN ACCOUNT
   ===================================================================== */

/* Values the app remembers while it is open */
let pendingRole = DB.get('pendingRole', null);   // role picked on the "Join as" screen
let filters = { q: '', maxPrice: '', perRoom: '', selfContained: false, availableOnly: false, wifi: false, sort: 'near', open: false }; // search filters on Home
let formImgs = [];                               // photos chosen in the Add/Edit listing form (max 5)

/* homeFor(): the first screen each type of user lands on after login */
function homeFor(u) { return u.role === 'admin' ? '#/admin' : u.role === 'landlord' ? '#/dashboard' : '#/home'; }

/* ---------- ADMIN ACCOUNT (created automatically the first time the app runs) ----------
   Log in with:  nawa@gmail.com  /  admin123
   Change these two values to your own.
   NOTE: if you already opened the app once, the old admin is already saved
   in the browser – clear the site data after changing these. */
const ADMIN_EMAIL = 'nawa@gmail.com';      // <-- admin login email
const ADMIN_PASSWORD = 'admin123';         // <-- admin login password
(function seedAdmin() {
  // Runs every time the page loads: creates the main admin if missing,
  // and always keeps its email/password equal to the two lines above.
  const all = users();
  let main = all.find(u => u.id === 'admin1');
  if (!main) {
    main = { id: 'admin1', role: 'admin', name: 'Administrator', phone: '', since: 'Admin', about: '', verified: true };
    all.push(main);
  }
  main.email = ADMIN_EMAIL;
  main.password = ADMIN_PASSWORD;
  DB.set('users', all);
})();
/* =====================================================================
   4. LAYOUT PIECES
   ===================================================================== */

/* authLayout(): the frame for Role / Register / Login screens.
   - Full-screen background picture (with a dark overlay)
   - Top-left: logo.  Top-RIGHT CORNER: "Log in" and "Sign up" buttons
   - Left: big headline + short selling points (`title` and `sub`)
   - Right: the white form card (`inner`)
   `bgUrl` is the picture to use. */
function authLayout(title, sub, inner, bgUrl) {
  return `<div class="auth2" style="${bg(bgUrl, ' fixed')}">
    <header class="auth2-top">
      <a class="logo logo-pill" href="#/role">${ICON.logo}${APP_NAME}</a>
      <nav aria-label="Account"><a class="btn btn-ghost-w btn-sm" href="#/login">Log in</a><a class="btn btn-accent btn-sm" href="#/role">Sign up</a></nav>
    </header>
    <main class="auth2-body" id="main" tabindex="-1">
      <section class="auth2-hero" aria-label="About ${APP_NAME}"><h1>${esc(title)}</h1><p>${esc(sub)}</p>
        <ul class="auth2-points"><li>Browse boarding houses close to campus</li><li>Filter by price, people per room and WiFi</li><li>Contact landlords by phone, email or WhatsApp</li></ul></section>
      <section class="auth-box" aria-label="Account form">${inner}</section>
    </main>
    <footer class="auth2-foot"><p>&copy; 2026 ${APP_NAME}</p></footer>
  </div>`;
}

/* shell(): the frame for every screen AFTER login – the top bar with the
   logo, the menu links (different for admin / landlord / tenant), the
   user's name and the Log out button. `inner` is the page content and
   `active` is the menu item to highlight. */
function shell(inner, active) {
  const u = me(); const isL = u.role === 'landlord';
  // Menu links depend on who is logged in: [link, label, name]
  const pend = isL ? requests().filter(r => r.status === 'pending' && listings().some(l => l.id === r.listingId && l.ownerId === u.id)).length : 0;
  const items = u.role === 'admin'
    ? [['#/admin', 'Admin panel', 'admin']]
    : isL
    ? [['#/dashboard', 'Dashboard', 'dashboard'], ['#/add-listing', 'Add listing', 'add'], ['#/requests', 'Requests' + (pend ? ` <span class="nbadge">${pend}</span>` : ''), 'requests'], ['#/profile', 'My profile', 'profile']]
    : [['#/home', 'Home', 'home'], ['#/map', 'Map', 'map'], ['#/saved', 'Saved', 'saved'], ['#/my-requests', 'My requests', 'mine']];
  $app.innerHTML = `<header class="topbar"><div class="topbar-in">
      <a class="logo" href="${homeFor(u)}">${ICON.logo}${APP_NAME}</a>
      <nav class="nav" aria-label="Main">${items.map(i => `<a href="${i[0]}" ${i[2] === active ? 'aria-current="page"' : ''}>${i[1]}</a>`).join('')}</nav>
      <div class="userbox"><span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><span class="uname">${esc(u.name)}</span>
      <button class="btn btn-ghost btn-sm" data-act="logout">Log out</button></div>
    </div></header><main class="container" id="main" tabindex="-1">${inner}</main>
    <footer class="site-footer"><p>&copy; 2026 ${APP_NAME}. Helping students find a safe place to stay near campus.</p></footer>`;
  window.scrollTo(0, 0);   // always start a new screen at the top
}

/* availBadge(): green "Available" or red "Full" label for a listing */
function availBadge(l) {
  return l.available ? '<span class="badge go">Available</span>' : '<span class="badge stop">Full</span>';
}

/* cardHtml(): one listing card (photo, title, price, tags).
   `withSave` = show the heart (save) button on the photo. */
function cardHtml(l, withSave) {
  const saved = savedIds().includes(l.id);
  return `<article class="card" data-act="open-listing" data-id="${l.id}">
    <div class="ph"><img src="${imgs(l)[0]}" alt="" loading="lazy">${availBadge(l)}${(l.images && l.images.length > 1) ? `<span class="photo-count">${l.images.length} photos</span>` : ''}
      ${withSave ? `<button class="save-btn" data-act="toggle-save" data-id="${l.id}" aria-label="${saved ? 'Remove from saved' : 'Save listing'}">${saved ? '♥' : '♡'}</button>` : ''}</div>
    <div class="body"><h3><a class="card-link" href="#/listing/${l.id}">${esc(l.title)}</a></h3>
      <div class="loc">${esc(l.location)} | ${l.distance} km to campus</div>
      <div class="price">${K(l.price)} <small>/ month</small></div>
      <div class="tags"><span class="tag">${l.perRoom} per room</span><span class="tag">${l.selfContained ? 'Self-contained' : 'Shared bathroom'}</span></div>
    </div></article>`;
}

/* =====================================================================
   5. AUTH SCREENS (before login)
   ===================================================================== */

/* viewRole(): first screen – "Join as a Tenant or Landlord" */
function viewRole() {
  $app.innerHTML = authLayout('Find a room that\'s close to class.', APP_NAME + ' connects off-campus students with landlords who have boarding houses nearby.', `
    <h2>Join as a…</h2><p style="color:var(--muted)">Choose how you will use the app.</p>
    <div class="role-grid">
      <button class="role-card" data-act="pick-role" data-role="tenant" aria-pressed="${pendingRole === 'tenant'}"><span class="ico">${ICON.tenant}</span><span><strong>Tenant</strong><span class="sub">I am looking for a place to rent near campus.</span></span></button>
      <button class="role-card" data-act="pick-role" data-role="landlord" aria-pressed="${pendingRole === 'landlord'}"><span class="ico">${ICON.landlord}</span><span><strong>Landlord</strong><span class="sub">I want to list my property for students to find.</span></span></button>
    </div>
    <button class="btn btn-primary btn-block" id="role-continue" data-act="role-continue" ${pendingRole ? '' : 'disabled'}>Continue</button>
    <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>`, IMAGES.roleBackground);
}

/* viewRegister(): sign-up form. The role (tenant/landlord) comes from the
   previous screen. Admins cannot be created here. */
function viewRegister() {
  if (!pendingRole) return go('#/role');   // no role chosen yet -> go back
  $app.innerHTML = authLayout('Create your account', pendingRole === 'tenant' ? 'Browse boarding houses, save favourites and send space requests.' : 'List your boarding houses and answer student requests in one place.', `
    <h2>Create your account</h2>
    <div class="role-chip">Registering as: <strong>${pendingRole === 'tenant' ? 'Tenant' : 'Landlord'}</strong> <a href="#/role" class="btn btn-ghost btn-sm">Change</a></div>
    <form data-form="register" novalidate>
      <div id="form-error"></div>
      <div class="field"><label for="r-name">Name</label><input id="r-name" name="name" type="text" placeholder="Full name" autocomplete="name" required></div>
      <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
      <div class="field"><label for="r-phone">Phone number</label><input id="r-phone" name="phone" type="tel" placeholder="+260 9XX XXX XXX" autocomplete="tel"><div class="hint">Shown to ${pendingRole === 'tenant' ? 'landlords you contact' : 'students who want to reach you'}.</div></div>
      <div class="field-row">
        <div class="field"><label for="r-pass">Password</label><input id="r-pass" name="password" type="password" placeholder="At least 8 characters" autocomplete="new-password" required><div class="hint">At least 8 characters, with a letter and a number.</div></div>
        <div class="field"><label for="r-pass2">Confirm password</label><input id="r-pass2" name="password2" type="password" placeholder="Repeat password" autocomplete="new-password" required></div>
      </div>
      <label class="show-pw" for="r-show" style="margin:-.3rem 0 1rem"><input id="r-show" type="checkbox" data-act="toggle-pw"> Show passwords</label>
      <fieldset class="field fieldset"><legend class="lbl">Preferred way to be contacted</legend><div class="check-row">
        <label for="r-c-phone"><input id="r-c-phone" type="radio" name="contact" value="Phone call"> Phone call</label>
        <label for="r-c-wa"><input id="r-c-wa" type="radio" name="contact" value="WhatsApp"> WhatsApp</label>
        <label for="r-c-mail"><input id="r-c-mail" type="radio" name="contact" value="Email"> Email</label></div></fieldset>
      <div class="field"><label for="r-year">${pendingRole === 'tenant' ? 'Year of study' : 'Properties you manage'}</label>
        <select id="r-year" name="year"><option value="">Select an option</option>${(pendingRole === 'tenant' ? ['1st year', '2nd year', '3rd year', '4th year', '5th year or above', 'Postgraduate'] : ['1 property', '2 to 3 properties', '4 or more properties']).map(o => `<option>${o}</option>`).join('')}</select></div>
      <div class="field"><label for="r-terms" class="chk-l"><input id="r-terms" type="checkbox" name="terms"> I agree to the terms of use and to share my contact details with ${pendingRole === 'tenant' ? 'landlords I contact' : 'students who contact me'}.</label></div>
      <button class="btn btn-primary btn-block" type="submit">Register</button>
    </form>
    <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>`, IMAGES.registerBackground);
}

/* viewLogin(): login form for tenants, landlords AND admins */
function viewLogin() {
  $app.innerHTML = authLayout('Welcome back', 'Log in to continue your search or manage your listings.', `
    <h2>Log in</h2>
    <form data-form="login" novalidate>
      <div id="form-error"></div>
      <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
      <div class="field"><label for="l-pass">Password</label><input id="l-pass" name="password" type="password" placeholder="Your password" autocomplete="current-password" required><label class="show-pw"><input type="checkbox" data-act="toggle-pw"> Show password</label></div>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
    <p class="auth-switch">New here? <a href="#/role">Create an account</a></p>
    <div class="demo-note"><strong>Try the demo accounts</strong> (password <code>demo123</code>)<br>Tenant: <code>student@demo.com</code><br>Landlord: <code>chanda@demo.com</code></div>`, IMAGES.loginBackground);
}

/* =====================================================================
   6. TENANT SCREENS
   ===================================================================== */

/* filtered(): the listings that match the search box and filters on Home,
   sorted from nearest to farthest from campus. */
function filtered() {
  const q = filters.q.trim().toLowerCase();
  return listings().filter(l => {
    // search text must appear in the title or location
    if (q && !(l.title + ' ' + l.location).toLowerCase().includes(q)) return false;
    // price must not be above the maximum
    if (filters.maxPrice && l.price > Number(filters.maxPrice)) return false;
    // people per room ("4" means 4 or more)
    if (filters.perRoom) { if (filters.perRoom === '4') { if (l.perRoom < 4) return false; } else if (l.perRoom !== Number(filters.perRoom)) return false; }
    if (filters.selfContained && !l.selfContained) return false;
    if (filters.availableOnly && !l.available) return false;
    if (filters.wifi && !l.utilities.includes('WiFi')) return false;
    return true;
  }).sort((a, b) => filters.sort === 'low' ? a.price - b.price : filters.sort === 'high' ? b.price - a.price : a.distance - b.distance);
}

/* drawCards(): redraws only the grid of cards + the "N places" counter,
   so the search box keeps focus while the student is typing. */
function drawCards() {
  const list = filtered(); const box = document.getElementById('cards'); if (!box) return;
  document.getElementById('count').textContent = list.length + (list.length === 1 ? ' place' : ' places');
  box.innerHTML = list.length ? list.map(l => cardHtml(l, true)).join('') :
    '<div class="empty" style="grid-column:1/-1"><h3>No places match</h3><p>Try a higher price, or clear a filter.</p><button class="btn btn-ghost" data-act="clear-filters">Clear filters</button></div>';
}

/* viewHome(): the tenant's main screen – welcome banner, search, filters
   and the grid of listing cards. */
function viewHome() {
  const u = me();
  shell(`<section class="welcome" style="${bg(IMAGES.homeBanner)}border-radius:14px;padding:1.5rem;color:#fff;">
      <h1 style="color:#fff">Welcome, ${esc(u.name.split(' ')[0])}</h1><p style="color:#fff">Find a boarding house close to campus, then send the landlord a request.</p>
      <div class="searchbar"><input type="search" data-filter="q" value="${esc(filters.q)}" placeholder="Search area or name…" aria-label="Search area or name">
        <button class="btn btn-accent" data-act="toggle-filters" aria-expanded="${filters.open}">Filters</button></div>
      <div class="filters" id="filters" ${filters.open ? '' : 'hidden'}>
        <div><label for="f-price">Max price (K / month)</label><input id="f-price" type="number" min="0" step="50" data-filter="maxPrice" value="${esc(filters.maxPrice)}" placeholder="Any"></div>
        <div><label for="f-room">People per room</label><select id="f-room" data-filter="perRoom"><option value="">Any</option>${[1, 2, 3].map(n => `<option value="${n}" ${filters.perRoom == n ? 'selected' : ''}>${n}</option>`).join('')}<option value="4" ${filters.perRoom == '4' ? 'selected' : ''}>4 or more</option></select></div>
        <div><label for="f-sort">Sort by</label><select id="f-sort" data-filter="sort"><option value="near" ${filters.sort === 'near' ? 'selected' : ''}>Nearest to campus</option><option value="low" ${filters.sort === 'low' ? 'selected' : ''}>Price: low to high</option><option value="high" ${filters.sort === 'high' ? 'selected' : ''}>Price: high to low</option></select></div>
        <label class="chk" for="f-self"><input id="f-self" type="checkbox" data-filter="selfContained" ${filters.selfContained ? 'checked' : ''}> Self-contained only</label>
        <label class="chk" for="f-avail"><input id="f-avail" type="checkbox" data-filter="availableOnly" ${filters.availableOnly ? 'checked' : ''}> Available only</label>
        <label class="chk" for="f-wifi"><input id="f-wifi" type="checkbox" data-filter="wifi" ${filters.wifi ? 'checked' : ''}> WiFi included</label>
      </div></section>
    <div class="section-head"><h2>Available near campus <small id="count" style="font-size:.9rem;color:var(--muted);font-family:var(--font-body);font-weight:400"></small></h2><a href="#/map" class="btn btn-ghost btn-sm">Map view</a></div>
    <div class="grid" id="cards"></div>`, 'home');
  drawCards();   // fill the empty grid with the matching cards
}

/* viewSaved(): the listings the tenant has hearted */
function viewSaved() {
  const ids = savedIds(); const list = listings().filter(l => ids.includes(l.id));
  shell(`<div class="page-head"><div><h1>Saved places</h1><p>Listings you've bookmarked.</p></div></div>
    ${list.length ? `<h2 class="sr-only">Saved listings</h2><div class="grid">${list.map(l => cardHtml(l, true)).join('')}</div>` : '<div class="empty"><h3>Nothing saved yet</h3><p>Tap the heart on a listing to keep it here.</p><a class="btn btn-primary" href="#/home">Browse listings</a></div>'}`, 'saved');
}

/* viewMyRequests(): space requests this tenant sent, with their status
   (waiting / accepted / declined) */
function viewMyRequests() {
  const u = me(); const list = requests().filter(r => r.tenantId === u.id).sort((a, b) => b.created - a.created);
  shell(`<div class="page-head"><div><h1>My requests</h1><p>Space requests you've sent to landlords.</p></div></div>
    ${list.length ? `<h2 class="sr-only">Your requests</h2><div class="req-list">${list.map(r => { const l = listingById(r.listingId); const o = l && userById(l.ownerId); if (!l) return ''; return `<div class="req"><div class="info"><h3 style="margin:0">${esc(l.title)}</h3><p>${esc(l.location)} | ${K(l.price)} / month | Move in ${fmtDate(r.moveIn)}</p><p>"${esc(r.message || 'No message')}"</p></div>
      <div style="text-align:right"><span class="badge ${r.status === 'accepted' ? 'go' : r.status === 'declined' ? 'stop' : 'wait'}">${r.status === 'accepted' ? 'Accepted' : r.status === 'declined' ? 'Declined' : 'Waiting for reply'}</span>
      <div class="actions" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-act="open-listing" data-id="${l.id}">View listing</button>${o ? `<button class="btn btn-primary btn-sm" data-act="contact" data-id="${l.id}">Contact owner</button>` : ''}</div></div></div>`; }).join('')}</div>`
      : '<div class="empty"><h3>No requests yet</h3><p>Open a listing and choose "Request a space".</p><a class="btn btn-primary" href="#/home">Browse listings</a></div>'}`, 'mine');
}

/* viewListing(): full details of ONE listing – photos, price, facts, owner,
   and the buttons (request a space, contact, save, map). */
function viewListing(id) {
  const l = listingById(id); if (!l) return go(me().role === 'landlord' ? '#/dashboard' : '#/home');
  const o = userById(l.ownerId); const u = me(); const isOwner = u.id === l.ownerId; const tenant = u.role === 'tenant';
  const pics = imgs(l); const saved = savedIds().includes(l.id);
  const myReq = requests().find(r => r.listingId === l.id && r.tenantId === u.id);   // did this tenant already request?
  // Decide which "request" button/label to show
  let reqBtn = '';
  if (tenant) {
    if (myReq) reqBtn = `<span class="badge ${myReq.status === 'accepted' ? 'go' : myReq.status === 'declined' ? 'stop' : 'wait'}">Request ${myReq.status}</span>`;
    else if (l.available) reqBtn = `<button class="btn btn-accent" data-act="request" data-id="${l.id}">Request a space</button>`;
    else reqBtn = '<button class="btn btn-ghost" disabled>Currently full</button>';
  }
  shell(`<a class="back" href="${tenant ? '#/home' : '#/dashboard'}">‹ ${tenant ? 'Back to results' : 'Back to dashboard'}</a>
    <div class="detail-top"><div class="price" style="font-size:1.8rem">${K(l.price)} <small>/ month</small></div>${availBadge(l)}</div>
    <div class="detail-grid">
      <div><div class="main-photo zoomable" data-act="lightbox" data-id="${l.id}" tabindex="0" role="button" title="Click to enlarge"><img id="main-img" src="${pics[0]}" alt="Photo of ${esc(l.title)}"></div>
        <div class="thumbs">${pics.slice(1).map((p, i) => `<button data-act="swap-img" data-src="${p}" aria-pressed="false" aria-label="Show photo ${i + 2}"><img src="${p}" alt=""></button>`).join('')}</div>
        <div class="panel" style="margin-top:1rem"><h2 style="font-size:1.15rem">About this place</h2><p style="margin:0">${esc(l.description)}</p></div></div>
      <div>
        <div class="panel"><h1 style="font-size:1.6rem">${esc(l.title)}</h1><p style="color:var(--muted)">${esc(l.location)} | ${l.distance} km from campus</p>
          <button class="owner-row" data-act="open-owner" data-id="${o.id}" data-l="${l.id}"><span class="avatar">${esc(initials(o.name))}</span><span class="who"><strong>${esc(o.name)}</strong><small>${o.verified ? 'Verified landlord' : 'Landlord'} | View full profile</small></span><span>›</span></button>
          <div class="tags" style="margin:1rem 0">${[l.bedrooms + ' bedroom' + (l.bedrooms > 1 ? 's' : ''), l.perRoom + ' per room', l.selfContained ? 'Self-contained' : 'Shared bathroom'].concat(l.utilities.map(x => x + ' incl.')).concat(l.amenities).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <dl class="facts"><div><dt>Deposit</dt><dd>${K(l.deposit)}</dd></div><div><dt>Available from</dt><dd>${fmtDate(l.availableFrom)}</dd></div><div><dt>Bathrooms</dt><dd>${l.bathrooms}</dd></div><div><dt>Distance to campus</dt><dd>${l.distance} km</dd></div></dl>
          <div class="actions">${tenant ? `${reqBtn}<button class="btn btn-primary" data-act="contact" data-id="${l.id}">Contact owner</button>
            <button class="btn btn-ghost" data-act="toggle-save" data-id="${l.id}" data-refresh="1">${saved ? '♥ Saved' : '♡ Save'}</button>
            <a class="btn btn-ghost" href="#/map/${l.id}">View on map</a>
            <button class="btn btn-ghost" data-act="copy-link">Share link</button>` : (isOwner ? `<a class="btn btn-primary" href="#/edit/${l.id}">Edit listing</a>` : '')}</div>
        </div></div>
    </div>`, tenant ? 'home' : 'dashboard');
}

/* viewOwner(): a landlord's public profile – rating, contact details,
   the selected property and a list of all their properties. */
function viewOwner(oid, lid) {
  const o = userById(oid); if (!o) return go('#/home');
  const props = listings().filter(l => l.ownerId === oid);   // all listings of this owner
  const sel = props.find(l => l.id === lid) || props[0];     // the one being shown
  const pics = sel ? imgs(sel) : [];
  const rt = ratingOf(o); const stars = '★'.repeat(Math.round(rt.avg)) + '☆'.repeat(5 - Math.round(rt.avg));
  shell(`<a class="back" href="${sel ? '#/listing/' + sel.id : '#/home'}">‹ Back to listing</a>
    <div class="profile-grid">
      <aside class="panel"><div class="profile-photo">${esc(initials(o.name))}</div><h1 style="font-size:1.5rem">${esc(o.name)}</h1>
        ${o.verified ? '<span class="badge go">Verified landlord</span>' : '<span class="badge wait plain">Not yet verified</span>'}
        <p style="margin:.8rem 0 0"><span class="stars">${stars}</span> ${rt.count ? rt.avg + ' / 5 (' + rt.count + ' review' + (rt.count > 1 ? 's' : '') + ')' : 'No reviews yet'}</p>
        <ul class="contact-list"><li><span>Phone</span><span>${esc(o.phone || '—')}</span></li><li><span>Email</span><span>${esc(o.email)}</span></li><li><span>Member since</span><span>${esc(o.since || '—')}</span></li><li><span>Properties listed</span><span>${props.length}</span></li></ul>
        <h2 style="font-size:1.15rem">About the owner</h2><p>${esc(o.about || 'This landlord has not added a description yet.')}</p>
        ${me().role === 'tenant' && sel ? `<button class="btn btn-primary btn-block" data-act="contact" data-id="${sel.id}">Contact owner</button>` : ''}</aside>
      <section>${sel ? `<div class="panel"><div class="detail-top" style="margin-bottom:.6rem"><div><h2 style="margin:0">${esc(sel.title)}</h2><span style="color:var(--muted)">${esc(sel.location)} | ${sel.distance} km from campus | Available from ${fmtDate(sel.availableFrom)}</span></div><div class="price">${K(sel.price)} <small>/ month</small></div></div>
        <div class="main-photo"><img src="${pics[0]}" alt=""></div><div class="thumbs">${pics.slice(1).map(p => `<button disabled><img src="${p}" alt=""></button>`).join('')}</div></div>
        <div class="panel"><h3>Property details</h3><dl class="facts"><div><dt>Bedrooms</dt><dd>${sel.bedrooms}</dd></div><div><dt>Bathrooms</dt><dd>${sel.bathrooms}</dd></div><div><dt>Distance to campus</dt><dd>${sel.distance} km</dd></div><div><dt>Deposit</dt><dd>${K(sel.deposit)}</dd></div><div><dt>Available from</dt><dd>${fmtDate(sel.availableFrom)}</dd></div><div><dt>Utilities</dt><dd>${sel.utilities.join(', ') || 'None included'}</dd></div></dl>
          <div class="tags" style="margin-top:1rem">${sel.amenities.map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div><p style="margin:1rem 0 0">${esc(sel.description)}</p>
          <div class="actions"><button class="btn btn-ghost" data-act="open-listing" data-id="${sel.id}">Open listing</button></div></div>` : '<div class="empty">This landlord has no listings yet.</div>'}
        ${props.length > 1 ? `<div class="panel"><h3>All properties (${props.length})</h3><div class="mini-list">${props.map(p => `<button class="mini ${sel && p.id === sel.id ? 'on' : ''}" data-act="open-owner" data-id="${o.id}" data-l="${p.id}"><img src="${imgs(p)[0]}" alt=""><span class="t"><strong>${esc(p.title)}</strong><br><small>${K(p.price)} / month</small></span>${availBadge(p)}</button>`).join('')}</div></div>` : ''}
      ${reviewsPanel(o)}</section></div>`, me().role === 'tenant' ? 'home' : 'dashboard');
}

/* reviewsPanel(): student reviews of a landlord. A tenant can leave (or
   update) a review once the landlord has accepted one of their requests. */
function reviewsPanel(o) {
  const u = me(); const rs = ratings().filter(r => r.landlordId === o.id).sort((a, b) => b.created - a.created);
  const ids = listings().filter(l => l.ownerId === o.id).map(l => l.id);
  const can = u.role === 'tenant' && requests().some(r => r.tenantId === u.id && r.status === 'accepted' && ids.includes(r.listingId));
  const mine = rs.find(r => r.tenantId === u.id);
  const form = can ? `<form data-form="review" data-id="${o.id}" novalidate style="margin-bottom:1rem">
      <div class="field"><label for="v-stars">Your rating</label><select id="v-stars" name="stars">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${mine && mine.stars === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})</option>`).join('')}</select></div>
      <div class="field"><label for="v-msg">Comment</label><textarea id="v-msg" name="comment" placeholder="How was your stay?">${esc(mine ? mine.comment : '')}</textarea></div>
      <button class="btn btn-primary btn-sm" type="submit">${mine ? 'Update review' : 'Post review'}</button></form>`
    : (u.role === 'tenant' ? '<p class="hint" style="color:var(--muted);font-size:.9rem">You can review this landlord after they accept one of your requests.</p>' : '');
  return `<div class="panel"><h3>Student reviews</h3>${form}${rs.length ? rs.map(r => { const t = userById(r.tenantId);
    return `<div class="review"><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span> <strong>${esc(t ? t.name.split(' ')[0] : 'Student')}</strong> <small style="color:var(--muted)">${new Date(r.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small><p>${esc(r.comment || 'No comment.')}</p></div>`; }).join('') : '<p style="color:var(--muted);margin:0">No student reviews yet.</p>'}</div>`;
}

/* viewMap(): a drawn map of the area with a pin for each listing.
   Green pin = available, red pin = full. The teal box is the campus.
   Each listing stores its pin position in l.mapX / l.mapY. */
function viewMap(focusId) {
  const list = listings().sort((a, b) => a.distance - b.distance);
  // pin(): draws one pin (an SVG teardrop shape) at the listing's position
  const pin = l => { const c = l.available ? '#1b7a40' : '#a8412c'; return `<g class="pin ${l.id === focusId ? 'on' : ''}" data-act="pin" data-id="${l.id}" transform="translate(${l.mapX},${l.mapY})" tabindex="0" role="button" aria-label="${esc(l.title)}, ${K(l.price)}">
      <path class="pin-shape" d="M0,0 C-8,-12 -15,-19 -15,-27 a15,15 0 1,1 30,0 C15,-19 8,-12 0,0Z" fill="${c}" stroke="#fff" stroke-width="2"/><circle cy="-27" r="5.5" fill="#fff"/></g>`; };
  shell(`<div class="page-head"><div><h1>Listings on the map</h1><p>See how far each place is from campus.</p></div><a class="btn btn-ghost" href="#/home">Back to list</a></div>
    <div class="map-layout"><div><div class="map-box">
      <svg viewBox="0 0 600 420" role="group" aria-label="Map of listings around campus">
        <rect width="600" height="420" fill="#e6eddc"/>
        <path d="M-10 330 C120 300 200 360 320 340 S520 270 610 300 L610 340 C520 310 420 380 320 385 S120 345 -10 372Z" fill="#b9d8e6"/>
        <g fill="#d7ddcb"><rect x="40" y="40" width="110" height="70" rx="6"/><rect x="170" y="30" width="90" height="60" rx="6"/><rect x="380" y="40" width="120" height="50" rx="6"/><rect x="60" y="150" width="90" height="70" rx="6"/><rect x="430" y="140" width="110" height="80" rx="6"/><rect x="60" y="240" width="110" height="50" rx="6"/></g>
        <g stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"><path d="M0 130 H600"/><path d="M0 255 H600"/><path d="M160 0 V300"/><path d="M400 0 V300"/><path d="M0 60 L170 130 L300 210 L600 400" stroke-width="6"/></g>
        <g><rect x="258" y="178" width="84" height="64" rx="8" fill="#0f4c5c"/><text x="300" y="206" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="13" font-weight="700">Campus</text><text x="300" y="224" text-anchor="middle" fill="#f2b134" font-family="sans-serif" font-size="11">Mulungushi</text></g>
        ${list.map(pin).join('')}
      </svg><button class="btn btn-primary btn-sm search-area" data-act="search-area">Search this area</button></div>
      <div class="legend"><span><i style="background:#1b7a40"></i>Available</span><span><i style="background:#a8412c"></i>Full</span><span><i style="background:#0f4c5c;border-radius:2px"></i>Campus</span></div></div>
      <div class="map-panel" id="map-panel">${list.map(l => `<div class="map-card ${l.id === focusId ? 'hl' : ''}" id="mc-${l.id}" data-act="open-listing" data-id="${l.id}" tabindex="0" role="button"><img src="${imgs(l)[0]}" alt=""><div><strong>${esc(l.title)}</strong><br><small style="color:var(--muted)">${l.distance} km from campus</small><br><span class="price" style="font-size:1rem">${K(l.price)}</span> ${availBadge(l)}</div></div>`).join('')}</div></div>
    <p style="color:var(--muted);margin-top:1rem;font-size:.9rem">Tap a pin to highlight its card, then tap the card to open the listing.</p>`, 'map');
  // If we came from a listing ("View on map"), scroll its card into view
  if (focusId) { const el = document.getElementById('mc-' + focusId); if (el) el.scrollIntoView({ block: 'nearest' }); }
}

/* =====================================================================
   7. LANDLORD SCREENS
   ===================================================================== */

/* viewDashboard(): landlord home – banner, 4 number boxes, and a table of
   the landlord's own properties with View / Edit / Delete buttons. */
function viewDashboard() {
  const u = me(); const mine = listings().filter(l => l.ownerId === u.id);        // this landlord's listings
  const reqs = requests().filter(r => mine.some(l => l.id === r.listingId));      // requests on those listings
  const pending = reqs.filter(r => r.status === 'pending');                       // still waiting for an answer
  shell(`<div class="page-head" style="${bg(IMAGES.dashboardBanner)}border-radius:14px;padding:1.5rem;color:#fff;min-height:140px;align-items:flex-end;"><div><h1 style="color:#fff">Welcome, ${esc(u.name)}</h1><p style="color:#fff;margin:.3rem 0 0">Manage your boarding houses and student requests.</p></div><a class="btn btn-accent" href="#/add-listing">Add listing</a></div>
    <div class="stats"><div class="stat"><b>${mine.length}</b><span>Properties listed</span></div><div class="stat"><b>${mine.filter(l => l.available).length}</b><span>Available now</span></div><div class="stat"><b>${pending.length}</b><span>Requests waiting</span></div><div class="stat"><b>${reqs.filter(r => r.status === 'accepted').length}</b><span>Requests accepted</span></div></div>
    <div class="section-head"><h2>Your properties</h2>${pending.length ? '<a href="#/requests" class="btn btn-ghost btn-sm">Review ' + pending.length + ' request' + (pending.length > 1 ? 's' : '') + '</a>' : ''}</div>
    ${mine.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Property</th><th scope="col">Price</th><th scope="col">Per room</th><th scope="col">Status</th><th scope="col">Requests</th><th scope="col">Actions</th></tr></thead><tbody>
      ${mine.map(l => `<tr><td><div class="row-title"><img src="${imgs(l)[0]}" alt=""><div><strong>${esc(l.title)}</strong><br><small style="color:var(--muted)">${esc(l.location)}</small></div></div></td><td>${K(l.price)}</td><td>${l.perRoom}${l.selfContained ? ' | self-contained' : ''}</td>
      <td><button class="badge ${l.available ? 'go' : 'stop'}" style="border:0;cursor:pointer" data-act="toggle-avail" data-id="${l.id}" aria-label="${esc(l.title)}: ${l.available ? 'Available' : 'Full'}. Activate to change." title="Click to change">${l.available ? 'Available' : 'Full'}</button></td>
      <td>${reqs.filter(r => r.listingId === l.id && r.status === 'pending').length || '—'}</td>
      <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-act="open-listing" data-id="${l.id}">View</button><a class="btn btn-ghost btn-sm" href="#/edit/${l.id}">Edit</a><button class="btn btn-danger btn-sm" data-act="delete-listing" data-id="${l.id}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><h3>No properties yet</h3><p>Add your first boarding house so students can find it.</p><a class="btn btn-primary" href="#/add-listing">Add listing</a></div>'}`, 'dashboard');
}

/* viewRequests(): requests students sent to this landlord.
   The landlord can Accept or Decline pending ones. */
function viewRequests() {
  const u = me(); const mineIds = listings().filter(l => l.ownerId === u.id).map(l => l.id);
  const list = requests().filter(r => mineIds.includes(r.listingId)).sort((a, b) => b.created - a.created);   // newest first
  shell(`<div class="page-head"><div><h1>Student requests</h1><p>Accept or decline requests, then contact the student by phone or email.</p></div></div>
    ${list.length ? `<h2 class="sr-only">Requests received</h2><div class="req-list">${list.map(r => { const l = listingById(r.listingId); const t = userById(r.tenantId); if (!l || !t) return ''; return `<div class="req"><div class="info"><h3 style="margin:0">${esc(t.name)} <small style="font-weight:400;color:var(--muted)">for ${esc(l.title)}</small></h3>
      <p>Move in: ${fmtDate(r.moveIn)} | <a href="tel:${esc(t.phone || '')}">${esc(t.phone || 'No phone')}</a> | <a href="mailto:${esc(t.email)}">${esc(t.email)}</a></p><p>"${esc(r.message || 'No message')}"</p></div>
      <div style="text-align:right">${r.status === 'pending' ? `<div class="actions" style="margin:0"><button class="btn btn-primary btn-sm" data-act="req-status" data-id="${r.id}" data-s="accepted">Accept</button><button class="btn btn-danger btn-sm" data-act="req-status" data-id="${r.id}" data-s="declined">Decline</button></div>` : `<span class="badge ${r.status === 'accepted' ? 'go' : 'stop'}">${r.status === 'accepted' ? 'Accepted' : 'Declined'}</span>`}</div></div>`; }).join('')}</div>`
      : '<div class="empty"><h3>No requests yet</h3><p>When a student requests a space, it will show up here.</p></div>'}`, 'requests');
}

/* viewListingForm(): the form used for BOTH "Add a listing" (no id) and
   "Edit listing" (with an id). When editing, the boxes start filled in. */
function viewListingForm(id) {
  const u = me(); const l = id ? listingById(id) : null;
  // A landlord may only edit their OWN listings
  if (id && (!l || l.ownerId !== u.id)) return go('#/dashboard');
  formImgs = l ? ((l.images && l.images.length) ? l.images.slice() : (l.img ? [l.img] : [])) : [];   // keep existing photos when editing
  // Starting values: the existing listing, or sensible blanks for a new one
  const v = l || { title: '', location: '', distance: 1, price: '', deposit: '', bedrooms: 1, bathrooms: 1, perRoom: 1, selfContained: false, available: true, availableFrom: new Date().toISOString().slice(0, 10), utilities: ['Water'], amenities: [], description: '' };
  // chk(): builds a row of tick boxes (utilities / features)
  const chk = (name, arr, opts) => opts.map(o => `<label for="${name}-${o}"><input id="${name}-${o}" type="checkbox" name="${name}" value="${o}" ${arr.includes(o) ? 'checked' : ''}> ${o}</label>`).join('');
  shell(`<a class="back" href="#/dashboard">‹ Back to dashboard</a><div class="page-head"><h1>${l ? 'Edit listing' : 'Add a listing'}</h1></div>
    <form class="form-card" data-form="listing" data-id="${l ? l.id : ''}" novalidate><div id="form-error"></div>
      <div class="field"><label for="f-title">Property title</label><input id="f-title" name="title" type="text" value="${esc(v.title)}" placeholder="e.g. Gate View Boarding House" required></div>
      <div class="field"><label for="f-loc">Location</label><input id="f-loc" name="location" type="text" value="${esc(v.location)}" placeholder="Area or street" required></div>
      <div class="field-row"><div class="field"><label for="f-dist">Distance to campus (km)</label><input id="f-dist" name="distance" type="number" min="0" step="0.1" value="${v.distance}" required></div>
        <div class="field"><label for="f-from">Available from</label><input id="f-from" name="availableFrom" type="date" value="${esc(v.availableFrom)}"></div></div>
      <div class="field-row"><div class="field"><label for="f-price">Price per month (K)</label><input id="f-price" name="price" type="number" min="0" value="${v.price}" required></div>
        <div class="field"><label for="f-dep">Deposit (K)</label><input id="f-dep" name="deposit" type="number" min="0" value="${v.deposit}"></div></div>
      <div class="field-row"><div class="field"><label for="f-bed">Bedrooms</label><input id="f-bed" name="bedrooms" type="number" min="1" value="${v.bedrooms}"></div>
        <div class="field"><label for="f-bath">Bathrooms</label><input id="f-bath" name="bathrooms" type="number" min="1" value="${v.bathrooms}"></div></div>
      <div class="field"><label for="f-per">People per room</label><input id="f-per" name="perRoom" type="number" min="1" max="8" value="${v.perRoom}"></div>
      <fieldset class="field fieldset"><legend class="lbl">Type</legend><div class="check-row"><label for="f-self-c"><input id="f-self-c" type="checkbox" name="selfContained" ${v.selfContained ? 'checked' : ''}> Self-contained (own bathroom)</label><label for="f-avail-c"><input id="f-avail-c" type="checkbox" name="available" ${v.available ? 'checked' : ''}> Available now</label></div></fieldset>
      <fieldset class="field fieldset"><legend class="lbl">Utilities included</legend><div class="check-row">${chk('utilities', v.utilities, ['Water', 'WiFi', 'Electricity'])}</div></fieldset>
      <fieldset class="field fieldset"><legend class="lbl">Features</legend><div class="check-row">${chk('amenities', v.amenities, ['Parking', 'Security', 'Furnished', 'Kitchen'])}</div></fieldset>
      <div class="field"><label for="f-desc">Description</label><textarea id="f-desc" name="description" placeholder="Tell students what makes this place a good fit.">${esc(v.description)}</textarea></div>
      <div class="field"><label for="f-img">Photos (up to ${MAX_PHOTOS})</label><input id="f-img" type="file" accept="image/*" multiple data-upload="1"><div class="hint">The first photo is the main one shown on the listing card. You can add them one by one or select several at once.</div><div id="photo-grid" class="photo-grid">${photoGridHtml()}</div></div>
      <div class="actions"><button class="btn btn-primary" type="submit">${l ? 'Save changes' : 'Publish listing'}</button><a class="btn btn-ghost" href="#/dashboard">Cancel</a></div>
    </form>`, 'add');
}

/* viewProfile(): landlord edits the phone number and "about" text that
   students see on the owner profile page. */
function viewProfile() {
  const u = me();
  shell(`<div class="page-head"><div><h1>My profile</h1><p>This is what students see when they open your owner page.</p></div></div>
    <form class="form-card" data-form="profile" novalidate><div id="form-error"></div>
      <div class="field"><label for="p-name">Name</label><input id="p-name" name="name" type="text" value="${esc(u.name)}" autocomplete="name" required></div>
      <div class="field"><label for="p-phone">Phone number</label><input id="p-phone" name="phone" type="tel" autocomplete="tel" value="${esc(u.phone || '')}" placeholder="+260 9XX XXX XXX"></div>
      <div class="field"><label for="p-about">About you</label><textarea id="p-about" name="about" placeholder="Tell students about your houses, rules and what to expect.">${esc(u.about || '')}</textarea></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Save profile</button></div>
    </form>`, 'profile');
}

/* =====================================================================
   8. ADMIN SCREEN
   One page with: number boxes, and tables for landlords, all listings,
   tenants and administrators, plus a form to add a new administrator.
   ===================================================================== */
function viewAdmin() {
  const all = users();
  const landlords = all.filter(u => u.role === 'landlord');
  const tenants = all.filter(u => u.role === 'tenant');
  const admins = all.filter(u => u.role === 'admin');
  const meId = me().id;                                       // the admin who is logged in
  const ls = listings();
  const count = id => ls.filter(l => l.ownerId === id).length;   // how many listings a landlord has

  // userRows(): table rows for landlords or tenants.
  // Landlords get extra columns: number of listings + Verified toggle.
  const userRows = (arr, isLandlord) => arr.map(u => `<tr>
      <td><strong>${esc(u.name)}</strong><br><small style="color:var(--muted)">${esc(u.email)}</small></td>
      <td>${esc(u.phone || '—')}</td>
      ${isLandlord ? `<td>${count(u.id)}</td>
      <td><button class="badge ${u.verified ? 'go' : 'wait'}" style="border:0;cursor:pointer" data-act="admin-verify" data-id="${u.id}" aria-label="${esc(u.name)}: ${u.verified ? 'Verified' : 'Not verified'}. Activate to change." title="Click to change">${u.verified ? 'Verified' : 'Not verified'}</button></td>` : ''}
      <td><div class="row-actions"><button class="btn btn-danger btn-sm" data-act="admin-remove-user" data-id="${u.id}">Remove</button></div></td></tr>`).join('');

  // table(): builds a whole table, or a "nothing here" message if no rows
  const table = (head, rows, empty) => rows ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty"><p>${empty}</p></div>`;

  shell(`<div class="page-head"><div><h1>Admin panel</h1><p>Remove unwanted landlords, tenants and listings.</p></div></div>
    <div class="stats"><div class="stat"><b>${landlords.length}</b><span>Landlords</span></div><div class="stat"><b>${tenants.length}</b><span>Tenants</span></div><div class="stat"><b>${ls.length}</b><span>Listings</span></div><div class="stat"><b>${requests().length}</b><span>Requests</span></div></div>

    <div class="section-head"><h2>Landlords</h2></div>
    ${table(['Landlord', 'Phone', 'Listings', 'Status', 'Actions'], userRows(landlords, true), 'No landlords have registered yet.')}

    <div class="section-head" style="margin-top:2rem"><h2>All listings</h2></div>
    ${table(['Property', 'Owner', 'Price', 'Status', 'Actions'], ls.map(l => { const o = userById(l.ownerId); return `<tr>
      <td><div class="row-title"><img src="${imgs(l)[0]}" alt=""><div><strong>${esc(l.title)}</strong><br><small style="color:var(--muted)">${esc(l.location)}</small></div></div></td>
      <td>${esc(o ? o.name : 'Unknown')}</td><td>${K(l.price)}</td><td>${availBadge(l)}</td>
      <td><div class="row-actions"><button class="btn btn-danger btn-sm" data-act="delete-listing" data-id="${l.id}">Remove</button></div></td></tr>`; }).join(''), 'No listings yet.')}

    <div class="section-head" style="margin-top:2rem"><h2>Tenants</h2></div>
    ${table(['Tenant', 'Phone', 'Actions'], userRows(tenants, false), 'No tenants have registered yet.')}

    <div class="section-head" style="margin-top:2rem"><h2>Administrators</h2></div>
    ${table(['Administrator', 'Actions'], admins.map(a => `<tr>
      <td><strong>${esc(a.name)}</strong>${a.id === meId ? ' <span class="badge go">You</span>' : ''}<br><small style="color:var(--muted)">${esc(a.email)}</small></td>
      <td><div class="row-actions">${a.id === meId ? '<small style="color:var(--muted)">Cannot remove yourself</small>' : `<button class="btn btn-danger btn-sm" data-act="admin-remove-admin" data-id="${a.id}">Remove</button>`}</div></td></tr>`).join(''), 'No administrators.')}

    <form class="form-card" data-form="admin-add" novalidate style="margin-top:1.2rem;max-width:560px"><div id="form-error"></div>
      <h3 style="margin-top:0">Add a new administrator</h3>
      <div class="field"><label for="a-name">Name</label><input id="a-name" name="name" type="text" placeholder="Full name" required></div>
      <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" placeholder="admin@example.com" autocomplete="off" required></div>
      <div class="field-row">
        <div class="field"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" placeholder="At least 8 characters" autocomplete="new-password" required></div>
        <div class="field"><label for="a-pass2">Confirm password</label><input id="a-pass2" name="password2" type="password" placeholder="Repeat password" autocomplete="new-password" required></div>
      </div>
      <button class="btn btn-primary" type="submit">Add administrator</button>
    </form>`, 'admin');
}

/* =====================================================================
   9. MODALS (pop-up boxes)
   ===================================================================== */

/* openModal(): shows a pop-up box with the given HTML inside */
let lastFocus = null;   // the button that opened a pop-up, so focus can return to it
function openModal(html) {
  if (!$modal.firstChild) lastFocus = document.activeElement;
  $modal.innerHTML = `<div class="modal-back" data-act="close-modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const h = $modal.querySelector('h2'), dlg = $modal.querySelector('.modal'); if (h) { h.id = 'modal-title'; dlg.setAttribute('aria-labelledby', 'modal-title'); }
  const f = $modal.querySelector('input,textarea,button,a'); if (f) f.focus();   // put the cursor in the first field
}

/* closeModal(): removes the pop-up box */
function closeModal() { const f = lastFocus; lastFocus = null; $modal.innerHTML = ''; lb = null; if (f && document.contains(f)) f.focus(); }

/* Full-screen photo viewer (click the big photo on a listing). `lb` holds
   which listing and which photo number is showing. */
let lb = null;
function showLightbox() {
  const p = imgs(listingById(lb.id));
  if (!$modal.firstChild) lastFocus = document.activeElement;
  $modal.innerHTML = `<div class="modal-back lb" data-act="close-modal-bg"><div class="lb-box" role="dialog" aria-modal="true" aria-label="Photo viewer"><img class="lb-img" src="${p[lb.i]}" alt="Photo ${lb.i + 1}">
    <button class="lb-x" data-act="close-modal" aria-label="Close">×</button>
    ${p.length > 1 ? `<button class="lb-nav lb-prev" data-act="lb-step" data-d="-1" aria-label="Previous photo">‹</button><button class="lb-nav lb-next" data-act="lb-step" data-d="1" aria-label="Next photo">›</button><span class="lb-count">${lb.i + 1} / ${p.length}</span>` : ''}</div></div>`;
  const x = $modal.querySelector('.lb-x'); if (x) x.focus();
}
function lbStep(d) { if (!lb) return; const n = imgs(listingById(lb.id)).length; lb.i = (lb.i + d + n) % n; showLightbox(); const b = $modal.querySelector(d > 0 ? '.lb-next' : '.lb-prev'); if (b) b.focus(); }

/* contactModal(): shows the owner's phone and email for a listing */
function contactModal(lid) {
  const l = listingById(lid); const o = userById(l.ownerId);
  openModal(`<h2>Contact ${esc(o.name)}</h2><p style="color:var(--muted)">About: ${esc(l.title)}. Reach out by phone or email.</p>
    <div class="contact-big"><a href="tel:${esc((o.phone || '').replace(/\s/g, ''))}">Call ${esc(o.phone || 'not provided')}</a>${o.phone ? `<a href="${waLink(o.phone, 'Hello, I am interested in ' + l.title)}" target="_blank" rel="noopener">WhatsApp ${esc(o.phone)}</a>` : ''}<a href="mailto:${esc(o.email)}?subject=${encodeURIComponent('Room enquiry: ' + l.title)}">Email ${esc(o.email)}</a></div>
    <div class="actions"><button class="btn btn-ghost" data-act="close-modal">Close</button></div>`);
}

/* requestModal(): the "Request a space" form (move-in date + message) */
function requestModal(lid) {
  const l = listingById(lid);
  openModal(`<h2>Request a space</h2><p style="color:var(--muted)">${esc(l.title)} | ${K(l.price)} / month</p>
    <form data-form="request" data-id="${l.id}"><div class="field"><label for="q-date">Move-in date</label><input id="q-date" name="moveIn" type="date" value="${esc(l.availableFrom)}" required></div>
      <div class="field"><label for="q-msg">Message to the landlord</label><textarea id="q-msg" name="message" placeholder="Introduce yourself and say what you need."></textarea></div>
      <div class="actions"><button type="button" class="btn btn-ghost" data-act="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Send request</button></div></form>`);
}

/* =====================================================================
   10. ACTIONS (click handling)
   Every button in the HTML has data-act="name". When it is clicked, the
   function with that same name below runs. `el` is the clicked element
   and its data-* attributes are read with el.dataset (e.g. data-id).
   ===================================================================== */
const actions = {
  /* ----- role / login ----- */
  'pick-role'(el) {                         // tenant or landlord card clicked
    pendingRole = el.dataset.role; DB.set('pendingRole', pendingRole);
    document.querySelectorAll('.role-card').forEach(b => b.setAttribute('aria-pressed', b === el));
    document.getElementById('role-continue').disabled = false;
  },
  'role-continue'() { if (pendingRole) go('#/register'); },
  logout() { DB.set('session', null); closeModal(); go('#/login'); },   // forget who is logged in

  /* ----- show / hide password ----- */
  'toggle-pw'(el) { el.closest('form').querySelectorAll('input[name="password"],input[name="password2"]').forEach(i => { i.type = el.checked ? 'text' : 'password'; }); },

  /* ----- full-screen photo viewer ----- */
  lightbox(el) {
    const l = listingById(el.dataset.id); const cur = document.getElementById('main-img').getAttribute('src');
    lb = { id: l.id, i: Math.max(0, imgs(l).indexOf(cur)) }; showLightbox();
  },
  'lb-step'(el) { lbStep(Number(el.dataset.d)); },

  /* ----- copy the page address ----- */
  'copy-link'() {
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => toast('Link copied'), () => toast('Copy the link from the address bar'));
    else toast('Copy the link from the address bar');
  },

  /* ----- accessibility helpers ----- */
  skip(el, e) { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); },
  'focus-field'(el) { const t = document.getElementById(el.dataset.id); if (t) t.focus(); },

  /* ----- navigation ----- */
  'open-listing'(el) { go('#/listing/' + el.dataset.id); },
  'open-owner'(el) { go('#/owner/' + el.dataset.id + '/' + (el.dataset.l || '')); },

  /* ----- search filters on Home ----- */
  'toggle-filters'(el) { filters.open = !filters.open; document.getElementById('filters').hidden = !filters.open; el.setAttribute('aria-expanded', filters.open); },
  'clear-filters'() { filters = { q: '', maxPrice: '', perRoom: '', selfContained: false, availableOnly: false, wifi: false, sort: 'near', open: true }; viewHome(); },

  /* ----- saving (heart) ----- */
  'toggle-save'(el) {                       // add or remove a listing from the tenant's saved list
    const all = DB.get('saved', {}); const sid = DB.get('session'); const arr = all[sid] || [];
    const i = arr.indexOf(el.dataset.id); if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.id);
    all[sid] = arr; DB.set('saved', all);
    toast(i >= 0 ? 'Removed from saved' : 'Saved to your list');
    // On the details page just change the button text; elsewhere redraw
    if (el.dataset.refresh) el.textContent = i >= 0 ? '♡ Save' : '♥ Saved';
    else { if (document.getElementById('cards')) drawCards(); else route(); const b = document.querySelector('.save-btn[data-id="' + el.dataset.id + '"]'); if (b) b.focus(); }
  },

  /* ----- listing details page ----- */
  'swap-img'(el) {                          // click a thumbnail: swap it with the big photo
    const main = document.getElementById('main-img'); const old = main.src; main.src = el.dataset.src;
    el.dataset.src = old; el.querySelector('img').src = old;
  },
  contact(el) { contactModal(el.dataset.id); },
  request(el) { requestModal(el.dataset.id); },

  /* ----- pop-up boxes ----- */
  'close-modal'() { closeModal(); },
  'close-modal-bg'(el, e) { if (e.target === el) closeModal(); },   // click outside the box closes it

  /* ----- map ----- */
  pin(el) {                                 // click a map pin: highlight its card
    document.querySelectorAll('.pin').forEach(p => p.classList.toggle('on', p === el));
    document.querySelectorAll('.map-card').forEach(c => c.classList.remove('hl'));
    const c = document.getElementById('mc-' + el.dataset.id); if (c) { c.classList.add('hl'); c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  },
  'search-area'() { const n = listings().filter(l => l.available).length; toast(n + ' places available in this area'); },

  /* ----- landlord: availability + delete listing (also used by admin) ----- */
  'toggle-avail'(el) {                      // switch a listing between Available and Full
    const all = listings(); const l = all.find(x => x.id === el.dataset.id); l.available = !l.available; DB.set('listings', all);
    toast(l.title + ' marked ' + (l.available ? 'available' : 'full')); route();
  },
  'delete-listing'(el) {                    // ask "are you sure?" first
    const l = listingById(el.dataset.id);
    openModal(`<h2>Delete this listing?</h2><p>"${esc(l.title)}" will be removed and students will no longer see it.</p><div class="actions"><button class="btn btn-ghost" data-act="close-modal">Keep it</button><button class="btn btn-danger" data-act="confirm-delete" data-id="${l.id}">Delete listing</button></div>`);
  },
  'confirm-delete'(el) {                    // really delete: the listing AND the requests on it
    DB.set('listings', listings().filter(l => l.id !== el.dataset.id));
    DB.set('requests', requests().filter(r => r.listingId !== el.dataset.id));
    closeModal(); toast('Listing deleted'); route();
  },

  /* ----- admin: remove another administrator ----- */
  'admin-remove-admin'(el) {                // ask first; an admin cannot remove themself
    const a = userById(el.dataset.id); if (!a || a.role !== 'admin' || a.id === me().id) return;
    openModal(`<h2>Remove administrator ${esc(a.name)}?</h2><p>They will no longer be able to log in to the admin panel.</p><div class="actions"><button class="btn btn-ghost" data-act="close-modal">Keep</button><button class="btn btn-danger" data-act="confirm-remove-admin" data-id="${a.id}">Remove administrator</button></div>`);
  },
  'confirm-remove-admin'(el) {
    const a = userById(el.dataset.id); if (!a || a.role !== 'admin' || a.id === me().id) return closeModal();
    DB.set('users', users().filter(x => x.id !== a.id));
    closeModal(); toast(a.name + ' removed as administrator'); route();
  },

  /* ----- admin: verify / unverify a landlord ----- */
  'admin-verify'(el) {
    const all = users(); const u = all.find(x => x.id === el.dataset.id); if (!u) return;
    u.verified = !u.verified; DB.set('users', all);
    toast(u.name + (u.verified ? ' is now verified' : ' is no longer verified')); route();
  },

  /* ----- admin: remove a landlord or tenant ----- */
  'admin-remove-user'(el) {                 // ask first (admins cannot be removed here)
    const u = userById(el.dataset.id); if (!u || u.role === 'admin') return;
    const extra = u.role === 'landlord' ? ' All of their listings and the requests on them will be removed too.' : ' Their requests and saved places will be removed too.';
    openModal(`<h2>Remove ${esc(u.name)}?</h2><p>This ${u.role} will be removed permanently.${extra}</p><div class="actions"><button class="btn btn-ghost" data-act="close-modal">Keep</button><button class="btn btn-danger" data-act="confirm-remove-user" data-id="${u.id}">Remove ${u.role}</button></div>`);
  },
  'confirm-remove-user'(el) {               // delete the user and everything that belongs to them
    const id = el.dataset.id; const u = userById(id); if (!u || u.role === 'admin') return closeModal();
    const ownedIds = listings().filter(l => l.ownerId === id).map(l => l.id);      // listings owned by this user (if a landlord)
    DB.set('listings', listings().filter(l => l.ownerId !== id));                  // remove their listings
    DB.set('requests', requests().filter(r => r.tenantId !== id && !ownedIds.includes(r.listingId)));   // remove requests sent by them or on their listings
    const saved = DB.get('saved', {}); delete saved[id];                           // remove their saved list
    Object.keys(saved).forEach(k => { saved[k] = saved[k].filter(x => !ownedIds.includes(x)); }); DB.set('saved', saved);   // remove their listings from other people's saved lists
    DB.set('ratings', ratings().filter(r => r.tenantId !== id && r.landlordId !== id));
    DB.set('users', users().filter(x => x.id !== id));                             // finally remove the user
    closeModal(); toast(u.name + ' removed'); route();
  },

  /* ----- landlord: photo previews in the listing form ----- */
  'remove-photo'(el) { formImgs.splice(Number(el.dataset.i), 1); drawPhotoGrid(); },
  'main-photo'(el) { const i = Number(el.dataset.i); const [p] = formImgs.splice(i, 1); formImgs.unshift(p); drawPhotoGrid(); },

  /* ----- landlord: accept / decline a student's request ----- */
  'req-status'(el) {
    const all = requests(); const r = all.find(x => x.id === el.dataset.id); r.status = el.dataset.s; DB.set('requests', all);
    toast('Request ' + r.status); route();
  }
};

/* One listener for ALL clicks: find the nearest element with data-act and
   run the matching function from `actions` above. */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (fn) fn(el, e);
});

/* Keyboard: Esc closes pop-ups; Enter/Space "click" cards and pins
   (so they work for people who use the keyboard). */
document.addEventListener('keydown', e => {
  if (e.key === 'Tab') {   // keep Tab inside an open pop-up
    const m = $modal.querySelector('.modal, .lb-box');
    if (m) {
      const f = Array.from(m.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea')).filter(x => x.offsetParent !== null);
      if (f.length) { const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
  }
  if (e.key === 'Escape') closeModal();
  if (lb && e.key === 'ArrowLeft') lbStep(-1);
  if (lb && e.key === 'ArrowRight') lbStep(1);
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});

/* Filters: update the results as the student types, without redrawing
   the search box (so the cursor does not jump out of it). */
document.addEventListener('input', e => {
  const key = e.target.dataset && e.target.dataset.filter; if (!key) return;
  filters[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; drawCards();
});
document.addEventListener('change', e => {
  // dropdowns and tick boxes in the filter panel
  if (e.target.dataset && e.target.dataset.filter) { const k = e.target.dataset.filter; filters[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; drawCards(); }
  // a photo was chosen in the Add/Edit listing form
  if (e.target.dataset && e.target.dataset.upload) handleUpload(e.target);
});

/* photoGridHtml(): the small previews under the photo picker, each with
   a "Main" and a "Remove" button, plus a counter. */
function photoGridHtml() {
  if (!formImgs.length) return '<p class="hint" style="margin:0">No photos yet. A default picture will be used.</p>';
  return formImgs.map((src, i) => `<div class="ph-item${i === 0 ? ' is-main' : ''}"><img src="${src}" alt="Photo ${i + 1}">
    ${i === 0 ? '<span class="ph-tag">Main</span>' : `<button type="button" class="ph-btn" data-act="main-photo" data-i="${i}">Make main</button>`}
    <button type="button" class="ph-x" data-act="remove-photo" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join('')
    + `<p class="hint" style="grid-column:1/-1;margin:0">${formImgs.length} of ${MAX_PHOTOS} photos</p>`;
}
function drawPhotoGrid() { const g = document.getElementById('photo-grid'); if (g) g.innerHTML = photoGridHtml(); }

/* readPhoto(): reads one chosen file, shrinks it to at most 800px wide
   (so five of them fit in browser storage) and returns it as a data URL. */
function readPhoto(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width); const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* handleUpload(): adds the chosen photos (up to MAX_PHOTOS in total). */
async function handleUpload(input) {
  const files = Array.from(input.files || []); input.value = '';
  if (!files.length) return;
  const room = MAX_PHOTOS - formImgs.length;
  if (room <= 0) return toast('You can add up to ' + MAX_PHOTOS + ' photos. Remove one first.');
  if (files.length > room) toast('Only ' + room + ' more photo' + (room > 1 ? 's' : '') + ' can be added.');
  for (const f of files.slice(0, room)) { const d = await readPhoto(f); if (d) formImgs.push(d); }
  drawPhotoGrid();
}

/* =====================================================================
   11. FORM SUBMISSIONS
   Every <form> has data-form="type". One listener handles them all and
   runs the block that matches the type.
   ===================================================================== */

/* showError(): shows a red message at the top of the form */
/* =====================================================================
   ACCESSIBLE FORM VALIDATION (WCAG 2.2 / WAI-ARIA)
   RULES says what each field needs. The engine then:
     - checks fields live (after you leave a field, and while you type)
     - sets aria-invalid="true" / "false" on each field
     - links the red message to its field with aria-describedby
     - announces a summary in a role="alert" box, and a polite status
       message (role="status") when the form becomes valid
   ===================================================================== */
const RULES = {
  register: {
    name: { label: 'Full name', required: true, min: 3, max: 60 },
    email: { label: 'Email', required: true, type: 'email' },
    phone: { label: 'Phone number', required: true, type: 'phone' },
    password: { label: 'Password', required: true, min: 8, custom: v => (/[A-Za-z]/.test(v) && /\d/.test(v)) ? '' : 'Password must include at least one letter and one number.' },
    password2: { label: 'Confirm password', required: true, match: 'password', matchMsg: 'The two passwords do not match.' },
    contact: { label: 'Preferred contact method', required: true, msg: 'Choose how you want to be contacted.' },
    year: { label: 'Year of study or properties', required: true, msg: 'Select an option from the list.' },
    terms: { label: 'Terms of use', required: true, msg: 'You must agree to the terms to create an account.' }
  },
  login: { email: { label: 'Email', required: true, type: 'email' }, password: { label: 'Password', required: true } },
  'admin-add': {
    name: { label: 'Name', required: true, min: 3, max: 60 }, email: { label: 'Email', required: true, type: 'email' },
    password: { label: 'Password', required: true, min: 8 }, password2: { label: 'Confirm password', required: true, match: 'password', matchMsg: 'The two passwords do not match.' }
  },
  profile: { name: { label: 'Name', required: true, min: 3, max: 60 }, phone: { label: 'Phone number', type: 'phone' }, about: { label: 'About you', max: 500 } },
  request: { moveIn: { label: 'Move-in date', required: true }, message: { label: 'Message', max: 300 } },
  listing: {
    title: { label: 'Property title', required: true, min: 3, max: 80 },
    location: { label: 'Location', required: true, min: 3, max: 80 },
    distance: { label: 'Distance to campus', required: true, type: 'number', minVal: 0, maxVal: 50 },
    price: { label: 'Price per month', required: true, type: 'number', gt: 0 },
    deposit: { label: 'Deposit', type: 'number', minVal: 0 },
    bedrooms: { label: 'Bedrooms', required: true, type: 'number', minVal: 1, maxVal: 20 },
    bathrooms: { label: 'Bathrooms', required: true, type: 'number', minVal: 1, maxVal: 20 },
    perRoom: { label: 'People per room', required: true, type: 'number', minVal: 1, maxVal: 8 },
    description: { label: 'Description', max: 600 }
  }
};

/* fieldValue(): the current value of a field, radio group or checkbox */
function fieldValue(form, name) {
  const els = form.querySelectorAll('[name="' + name + '"]'); if (!els.length) return null;
  const f = els[0];
  if (f.type === 'radio') { const c = form.querySelector('[name="' + name + '"]:checked'); return c ? c.value : ''; }
  if (f.type === 'checkbox') return f.checked ? 'on' : '';
  return (f.value || '').trim();
}

/* ruleError(): returns the error message for one field ('' = field is fine) */
function ruleError(form, name, r) {
  const v = fieldValue(form, name); if (v === null) return '';
  const L = r.label || name;
  if (!v) return r.required ? (r.msg || L + ' is required.') : '';
  if (r.min && v.length < r.min) return L + ' must be at least ' + r.min + ' characters.';
  if (r.max && v.length > r.max) return L + ' must be ' + r.max + ' characters or fewer.';
  if (r.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address, like you@example.com.';
  if (r.type === 'phone' && !/^(\+260|0)\d{9}$/.test(v.replace(/[\s-]/g, ''))) return 'Enter a valid phone number, like +260 977 123 456 or 0977 123 456.';
  if (r.type === 'number') {
    const n = Number(v);
    if (isNaN(n)) return L + ' must be a number.';
    if (r.gt !== undefined && !(n > r.gt)) return L + ' must be greater than ' + r.gt + '.';
    if (r.minVal !== undefined && n < r.minVal) return L + ' must be ' + r.minVal + ' or more.';
    if (r.maxVal !== undefined && n > r.maxVal) return L + ' must be ' + r.maxVal + ' or less.';
  }
  if (r.match && v !== fieldValue(form, r.match)) return r.matchMsg || 'The two values do not match.';
  if (r.custom) { const m = r.custom(v); if (m) return m; }
  return '';
}

/* enhanceForm(): runs once for every form on screen. Adds the error
   holder, aria-describedby, aria-required, the "*" marks, an alert box
   and a polite status region. */
function enhanceForm(form) {
  form.dataset.enh = '1';
  const type = form.dataset.form, rules = RULES[type]; if (!rules) return;
  let box = form.querySelector('#form-error');
  if (!box) { box = document.createElement('div'); box.id = 'form-error'; form.prepend(box); }
  box.setAttribute('role', 'alert'); box.setAttribute('aria-atomic', 'true');
  const note = document.createElement('p'); note.className = 'req-note'; note.innerHTML = '<span aria-hidden="true">*</span> marks a required field.'; box.after(note);
  const status = document.createElement('p'); status.className = 'sr-only'; status.id = 'status-' + type; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); form.append(status);
  Object.keys(rules).forEach(name => {
    const els = form.querySelectorAll('[name="' + name + '"]'); if (!els.length) return;
    const first = els[0], r = rules[name], group = first.type === 'radio' ? first.closest('fieldset') : null;
    const holder = group || first.closest('.field') || first.parentElement;
    const err = document.createElement('div'); err.className = 'field-err'; err.id = 'err-' + type + '-' + name; holder.append(err);
    const hint = holder.querySelector('.hint'); let ids = err.id;
    if (hint) { hint.id = hint.id || 'hint-' + type + '-' + name; ids = hint.id + ' ' + err.id; }
    if (group) { group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-describedby', ids); if (r.required) group.setAttribute('aria-required', 'true'); }
    else els.forEach(el => { el.setAttribute('aria-describedby', ids); if (r.required) el.setAttribute('aria-required', 'true'); });
    if (r.required) {
      const lab = group ? group.querySelector('legend') : form.querySelector('label[for="' + first.id + '"]');
      if (lab && !lab.querySelector('.req-mark')) lab.insertAdjacentHTML('beforeend', '<span class="req-mark" aria-hidden="true"> *</span>');
    }
  });
}
new MutationObserver(() => document.querySelectorAll('form[data-form]:not([data-enh])').forEach(enhanceForm))
  .observe(document.body, { childList: true, subtree: true });

/* validateField(): checks ONE field and updates its aria-invalid + message */
function validateField(form, name) {
  const type = form.dataset.form, r = (RULES[type] || {})[name]; if (!r) return '';
  const els = form.querySelectorAll('[name="' + name + '"]'); if (!els.length) return '';
  const msg = ruleError(form, name, r);
  const err = document.getElementById('err-' + type + '-' + name); if (err) err.textContent = msg;
  const group = els[0].type === 'radio' ? els[0].closest('fieldset') : null;
  (group ? [group] : Array.from(els)).forEach(el => { el.setAttribute('aria-invalid', msg ? 'true' : 'false'); el.classList.toggle('is-invalid', !!msg); });
  if (name === 'password') { const p2 = form.querySelector('[name="password2"]'); if (p2 && p2.dataset.touched) validateField(form, 'password2'); }
  return msg;
}

/* validateForm(): checks every field when Submit is pressed. Shows an
   error summary (read aloud by screen readers) and moves focus to the
   first problem. Returns true only if everything is valid. */
function validateForm(form) {
  const type = form.dataset.form, rules = RULES[type], errs = [];
  Object.keys(rules).forEach(name => { const m = validateField(form, name); if (m) { const el = form.querySelector('[name="' + name + '"]'); errs.push({ msg: m, id: el.id }); } });
  const box = document.getElementById('form-error');
  if (!errs.length) { if (box) box.innerHTML = ''; return true; }
  if (box) box.innerHTML = `<div class="form-error"><strong>${errs.length === 1 ? '1 problem needs fixing' : errs.length + ' problems need fixing'}:</strong><ul>${errs.map(e => `<li><button type="button" class="link-btn" data-act="focus-field" data-id="${esc(e.id)}">${esc(e.msg)}</button></li>`).join('')}</ul></div>`;
  const first = document.getElementById(errs[0].id); if (first) first.focus();
  return false;
}

/* refreshStatus(): polite message when the whole form becomes valid */
function refreshStatus(f) {
  const type = f.dataset.form, rules = RULES[type];
  const ok = Object.keys(rules).every(n => !ruleError(f, n, rules[n]));
  const s = document.getElementById('status-' + type); if (s) s.textContent = ok ? 'All required information is valid. You can submit the form.' : '';
  const box = document.getElementById('form-error'); if (ok && box && !box.querySelector('.srv')) box.innerHTML = '';
}

/* Live checking: on leaving a field (blur) and while typing afterwards */
function liveCheck(e, force) {
  const t = e.target, f = t && t.form; if (!f || !f.dataset || !RULES[f.dataset.form] || !t.name || !RULES[f.dataset.form][t.name]) return;
  const discrete = t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT';
  if (force || discrete) t.dataset.touched = '1';
  if (t.dataset.touched) { validateField(f, t.name); refreshStatus(f); }
}
document.addEventListener('input', e => liveCheck(e, false));
document.addEventListener('change', e => liveCheck(e, false));
document.addEventListener('focusout', e => { if (e.target.type !== 'radio' && e.target.type !== 'checkbox') liveCheck(e, true); });

/* showError(): a message from the server-side style checks (e.g. wrong password) */
function showError(msg) { const b = document.getElementById('form-error'); if (b) { b.innerHTML = `<div class="form-error srv">${esc(msg)}</div>`; b.scrollIntoView({ block: 'nearest' }); } }

document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]'); if (!form) return; e.preventDefault();   // stop the page from reloading
  const fd = new FormData(form); const type = form.dataset.form;
  if (RULES[type] && !validateForm(form)) return;   // stop here if any field is invalid
                          // fd = the values typed in the form

  /* ----- REGISTER: create a new tenant or landlord account ----- */
  if (type === 'register') {
    const name = fd.get('name').trim(), email = fd.get('email').trim().toLowerCase(), pw = fd.get('password');
    // Check everything before saving
    if (!name) return showError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address, like you@example.com.');
    if (pw.length < 8) return showError('Use a password with at least 8 characters.');
    if (pw !== fd.get('password2')) return showError('The two passwords do not match.');
    const all = users(); if (all.some(u => u.email === email)) return showError('That email already has an account. Log in instead.');
    // Save the new user, log them in, and send them to their home screen
    const u = { id: uid('u'), role: pendingRole, name, email, password: pw, phone: fd.get('phone').trim(), contact: fd.get('contact') || '', year: fd.get('year') || '', since: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), about: '', verified: false };
    all.push(u); DB.set('users', all); DB.set('session', u.id); toast('Account created');
    go(homeFor(u));
  }

  /* ----- LOGIN: tenants, landlords and admins ----- */
  if (type === 'login') {
    const email = fd.get('email').trim().toLowerCase(); const u = users().find(x => x.email === email && x.password === fd.get('password'));
    if (!u) return showError('Email or password is incorrect. Check both and try again.');
    DB.set('session', u.id); go(homeFor(u));   // remember who is logged in
  }

  /* ----- ADMIN-ADD: an admin creates another administrator ----- */
  if (type === 'admin-add') {
    if (!me() || me().role !== 'admin') return;   // only a logged-in admin may do this
    const name = fd.get('name').trim(), email = fd.get('email').trim().toLowerCase(), pw = fd.get('password');
    if (!name) return showError('Enter the administrator\'s name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address.');
    if (pw.length < 8) return showError('Use a password with at least 8 characters.');
    if (pw !== fd.get('password2')) return showError('The two passwords do not match.');
    const all = users(); if (all.some(u => u.email === email)) return showError('That email already has an account.');
    all.push({ id: uid('u'), role: 'admin', name, email, password: pw, phone: '', since: 'Admin', about: '', verified: true });
    DB.set('users', all); toast(name + ' added as administrator'); route();
  }

  /* ----- PROFILE: a landlord updates their own details ----- */
  if (type === 'profile') {
    const all = users(); const u = all.find(x => x.id === me().id); const name = fd.get('name').trim();
    if (!name) return showError('Enter your name.');
    u.name = name; u.phone = fd.get('phone').trim(); u.about = fd.get('about').trim();
    DB.set('users', all); toast('Profile saved'); route();
  }

  /* ----- REVIEW: a tenant rates a landlord ----- */
  if (type === 'review') {
    const u = me(); if (!u || u.role !== 'tenant') return; const lid = form.dataset.id; const stars = Number(fd.get('stars'));
    const ids = listings().filter(l => l.ownerId === lid).map(l => l.id);
    if (!requests().some(r => r.tenantId === u.id && r.status === 'accepted' && ids.includes(r.listingId))) return toast('Only accepted tenants can review');
    if (!(stars >= 1 && stars <= 5)) return toast('Choose a star rating');
    const all = ratings().filter(r => !(r.landlordId === lid && r.tenantId === u.id));
    all.push({ id: uid('v'), landlordId: lid, tenantId: u.id, stars, comment: fd.get('comment').trim(), created: Date.now() });
    DB.set('ratings', all); toast('Thanks for your review'); route();
  }

  /* ----- REQUEST: a tenant asks a landlord for a space ----- */
  if (type === 'request') {
    const lid = form.dataset.id; const u = me();
    // Do not allow two pending requests for the same listing
    if (requests().some(r => r.listingId === lid && r.tenantId === u.id && r.status === 'pending')) { closeModal(); return toast('You already have a pending request here'); }
    const all = requests(); all.push({ id: uid('r'), listingId: lid, tenantId: u.id, moveIn: fd.get('moveIn'), message: fd.get('message').trim(), status: 'pending', created: Date.now() });
    DB.set('requests', all); closeModal(); toast('Request sent to the landlord'); route();
  }

  /* ----- LISTING: a landlord adds a new listing or saves edits ----- */
  if (type === 'listing') {
    const title = fd.get('title').trim(), location = fd.get('location').trim(), price = Number(fd.get('price'));
    if (!title || !location) return showError('Add a title and a location.');
    if (!price || price <= 0) return showError('Enter the monthly price in Kwacha.');
    const dist = Number(fd.get('distance')) || 1;
    const all = listings(); const id = form.dataset.id; let l = id ? all.find(x => x.id === id) : null;   // l = existing listing when editing
    // All the values typed into the form, turned into one object
    const data = { title, location, distance: dist, price, deposit: Number(fd.get('deposit')) || 0, bedrooms: Number(fd.get('bedrooms')) || 1, bathrooms: Number(fd.get('bathrooms')) || 1, perRoom: Number(fd.get('perRoom')) || 1, selfContained: fd.get('selfContained') === 'on', available: fd.get('available') === 'on', availableFrom: fd.get('availableFrom'), utilities: fd.getAll('utilities'), amenities: fd.getAll('amenities'), description: fd.get('description').trim() || 'No description yet.', images: formImgs.slice(0, MAX_PHOTOS), img: undefined };
    if (l) Object.assign(l, data);   // EDIT: update the existing listing
    else {
      // NEW: give it an id, an owner, a random picture seed (hue) and a map position.
      // The map position is placed around the campus: farther away = farther from the centre.
      const ang = Math.random() * Math.PI * 2, r = Math.min(Math.max(dist, 0.3), 3) * 60;
      l = Object.assign({ id: uid('l'), ownerId: me().id, hue: Math.floor(Math.random() * 360), mapX: Math.round(Math.min(560, Math.max(40, 300 + Math.cos(ang) * r * 1.3))), mapY: Math.round(Math.min(390, Math.max(60, 210 + Math.sin(ang) * r))) }, data); all.push(l);
    }
    // DB.set returns false if the browser storage is full (e.g. photo too big)
    if (!DB.set('listings', all)) return showError('Could not save. The photo may be too large; try a smaller one.');
    toast(id ? 'Listing updated' : 'Listing published'); go('#/dashboard');
  }
});

/* =====================================================================
   12. ROUTER
   The part of the web address after "#" (for example "#/home" or
   "#/listing/l123") decides which screen is shown. route() runs on page
   load and every time that part changes.
   ===================================================================== */
const TITLES = { role: 'Join', register: 'Create account', login: 'Log in', home: 'Find a place', map: 'Map', saved: 'Saved places', 'my-requests': 'My requests', listing: 'Listing details', owner: 'Owner profile', dashboard: 'Dashboard', 'add-listing': 'Add listing', edit: 'Edit listing', requests: 'Student requests', profile: 'My profile', admin: 'Admin panel' };
function route() {
  closeModal();
  // Split "#/listing/l123" into ["listing", "l123"]; `page` is the first part
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/'); const page = parts[0];
  document.title = (TITLES[page] || 'Welcome') + ' – ' + APP_NAME;   // each screen gets its own page title
  const u = me();                                          // who is logged in (if anyone)
  const publicPages = ['role', 'register', 'login'];       // screens anyone can see

  // Not logged in -> only the public screens are allowed
  if (!u) { if (!publicPages.includes(page)) return go('#/role'); }
  // Logged in -> skip the public screens and go to your own home
  else if (publicPages.includes(page) || page === '') return go(homeFor(u));

  if (!u) return ({ role: viewRole, register: viewRegister, login: viewLogin })[page]();

  // Admins may ONLY see the admin page, and nobody else may see it
  if (u.role === 'admin' && page !== 'admin') return go('#/admin');
  if (u.role !== 'admin' && page === 'admin') return go(homeFor(u));

  // Keep tenants and landlords out of each other's screens
  const tenantOnly = ['home', 'map', 'saved', 'my-requests'], landlordOnly = ['dashboard', 'add-listing', 'requests', 'edit', 'profile'];
  if (u.role === 'landlord' && tenantOnly.includes(page)) return go('#/dashboard');
  if (u.role === 'tenant' && landlordOnly.includes(page)) return go('#/home');

  // Show the screen that matches the address
  switch (page) {
    case 'home': return viewHome();
    case 'saved': return viewSaved();
    case 'my-requests': return viewMyRequests();
    case 'map': return viewMap(parts[1]);
    case 'listing': return viewListing(parts[1]);
    case 'owner': return viewOwner(parts[1], parts[2]);
    case 'dashboard': return viewDashboard();
    case 'add-listing': return viewListingForm();
    case 'edit': return viewListingForm(parts[1]);
    case 'requests': return viewRequests();
    case 'profile': return viewProfile();
    case 'admin': return viewAdmin();
    default: return go(homeFor(u));   // unknown address -> your home screen
  }
}

/* Start the app: redraw whenever the "#" part of the address changes,
   and draw the first screen now. */
window.addEventListener('hashchange', () => {
  route();
  const m = document.getElementById('main'); if (m) m.focus({ preventScroll: true });          // keyboard users start at the new page
  const a = document.getElementById('announce'); if (a) a.textContent = 'Page loaded: ' + document.title;   // screen reader announcement
});
route();