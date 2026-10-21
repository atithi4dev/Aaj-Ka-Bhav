// icons.js: flat crop pictograms, drawn in the crop's own colours. No library, no network.
// Keyed by the standard commodity name (first word, lower case). Unknown crops fall back to the first letter.

const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;

const grain = (cx, cy, rot, fill, rx = 3.2, ry = 6.4) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${fill}"/>`;

const ICONS = {
  wheat: svg(
    `<path d="M24 45V15" stroke="#8A6A14" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="8" rx="3" ry="6" fill="#D4A21C"/>` +
    [17, 25, 33].map((y) => grain(18.5, y, -28, '#D4A21C') + grain(29.5, y, 28, '#D4A21C')).join('')
  ),
  paddy: svg(
    `<path d="M10 45C12 27 22 13 39 10" fill="none" stroke="#6B8F2E" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M10 45C15 37 22 34 29 36C23 41 17 43 10 45Z" fill="#5E9A3A"/>` +
    [[15, 31], [19, 23], [25, 17], [32, 12.5]].map(([x, y]) => grain(x + 2.5, y + 5, 12, '#C9A92B', 2.6, 5)).join('') +
    grain(40, 11, 80, '#C9A92B', 2.6, 5)
  ),
  maize: svg(
    `<ellipse cx="24" cy="22" rx="9" ry="17" fill="#F2C230"/>` +
    [11, 16, 21, 26, 31].map((y) => [19.5, 24, 28.5].map((x) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#D99E0E"/>`).join('')).join('') +
    `<path d="M24 45C10 41 8 27 14 14C16 26 20 35 24 45Z" fill="#5E9A3A"/>` +
    `<path d="M24 45C38 41 40 27 34 14C32 26 28 35 24 45Z" fill="#4E8A30"/>`
  ),
  mustard: svg(
    `<path d="M24 45V15M24 35L14 25M24 30L35 20" stroke="#5E9A3A" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<ellipse cx="17" cy="40" rx="5.5" ry="2.6" transform="rotate(-25 17 40)" fill="#5E9A3A"/>` +
    [[24, 11], [14, 21], [35, 16.5], [19.5, 15], [30, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#F4CC1E"/><circle cx="${x}" cy="${y}" r="1.4" fill="#B98A00"/>`).join('')
  ),
  potato: svg(
    `<path d="M7 28C5 17 16 9 26 11C39 11 45 20 42 30C39 40 24 43 15 40C10 38 7 34 7 28Z" fill="#C99A5B"/>` +
    [[18, 22], [30, 19], [28, 32], [15, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#8C6532"/>`).join('')
  ),
  onion: svg(
    `<path d="M24 14C34 18 40 26 36 35C33 42 15 42 12 35C8 26 14 18 24 14Z" fill="#9A4A9C"/>` +
    `<path d="M24 16C18 24 18 34 24 41M24 16C30 24 30 34 24 41" fill="none" stroke="#C27FC4" stroke-width="1.6"/>` +
    `<path d="M24 14C24 9 22 6 20 3M24 14C25 9 27 6 29 3" fill="none" stroke="#6BA04A" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M20 41L19 45M24 42L24 46M28 41L29 45" stroke="#B9A77F" stroke-width="1.6" stroke-linecap="round"/>`
  ),
  tomato: svg(
    `<circle cx="24" cy="27" r="15.5" fill="#D8392B"/>` +
    `<ellipse cx="17.5" cy="21.5" rx="3.4" ry="2.2" transform="rotate(-35 17.5 21.5)" fill="#F26B5C"/>` +
    `<path d="M24 9L26.4 14.5L32 12.5L28.6 17.2L33 20.5L27 20.8L24 25L21 20.8L15 20.5L19.4 17.2L16 12.5L21.6 14.5Z" fill="#4E8F2F"/>`
  ),
  soyabean: svg(
    `<path d="M7 31C7 18 17 10 30 8C40 7 43 12 41 19C37 31 25 41 15 41C10 41 7 37 7 31Z" fill="#7AAE3A"/>` +
    [[16.5, 31], [24, 23.5], [32, 16.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#B7DB6A"/>`).join('')
  ),
};

/** SVG markup for a commodity, or a lettered circle if there is no drawing for it yet. */
export function cropIcon(name, label = '') {
  const key = String(name || '').toLowerCase().split(/[\s(]/)[0];
  if (ICONS[key]) return ICONS[key];
  const ch = (label || name || '?').trim().charAt(0);
  return svg(`<circle cx="24" cy="24" r="18" fill="#C9D3C5"/><text x="24" y="31" text-anchor="middle" font-size="22" font-weight="700" fill="#14221A">${ch}</text>`);
}
