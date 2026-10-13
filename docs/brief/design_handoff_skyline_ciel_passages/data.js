(function () {
  const IMG = {
    ib: 'https://b3177907.assetcdn.net/2.0/3177907/wp-content/uploads/2012/03/IB_IberiaAirlines_Spain_Dec2022_v3.png?lossy=2&strip=1&webp=1',
    af: 'https://b3177907.assetcdn.net/2.0/3177907/wp-content/uploads/2012/05/AF_AirFrance_France_Dec2022_v3.png?lossy=2&strip=1&webp=1'
  };
  const A = {
    ib: { k: 'ib', name: 'Iberia', country: 'Espagne', bg: '#C8102E', sec: '#F6C344', fin: { base: '#F6C344', a1: '#8E0A22', a2: 'none', disc: 'none' }, flight: 'IB3457', from: 'CDG', to: 'MAD', fromCity: 'Paris', toCity: 'Madrid', cities: 'Paris → Madrid', type: 'A320neo', typeFull: 'Airbus A320neo', reg: 'EC-NVS', alt: '7 850', speed: '780', cap: 'SSO', capDeg: '205°', dist: '2,4 km', dep: '13:05', arr: '15:10', prog: 18, km: '1 065', rarity: 'Peu commun', rank: 2, no: '014', count: 7, seen: '11.10.26 · 13:27', len: '37,57 m', span: '35,80 m', eng: 'CFM LEAP-1A', seats: '186' },
    af: { k: 'af', name: 'Air France', country: 'France', bg: '#0B1F4B', sec: '#F4F1EA', fin: { base: '#F4F1EA', a1: '#2B5BD6', a2: '#E1251B', disc: 'none' }, flight: 'AF1506', from: 'CDG', to: 'DUS', fromCity: 'Paris', toCity: 'Düsseldorf', cities: 'Paris → Düsseldorf', type: 'E190', typeFull: 'Embraer 190', reg: 'F-HBLA', alt: '11 200', speed: '830', cap: 'ENE', capDeg: '62°', dist: '5,1 km', dep: '21:55', arr: '23:05', prog: 64, km: '410', rarity: 'Commun', rank: 1, no: '015', count: 23, seen: '11.10.26 · 22:48', len: '36,24 m', span: '28,72 m', eng: 'GE CF34-10E', seats: '100' },
    u2: { k: 'u2', name: 'easyJet', country: 'Royaume-Uni', bg: '#FF6600', sec: '#FFFFFF', fin: { base: '#FFFFFF', a1: '#FF6600', a2: 'none', disc: 'none' }, flight: 'U24617', from: 'CDG', to: 'NCE', fromCity: 'Paris', toCity: 'Nice', cities: 'Paris → Nice', type: 'A320', typeFull: 'Airbus A320', reg: 'G-EZWX', alt: '9 400', speed: '820', cap: 'SSE', capDeg: '152°', dist: '3,8 km', dep: '13:10', arr: '14:40', prog: 30, km: '690', rarity: 'Commun', rank: 1, no: '016', count: 12, seen: '11.10.26 · 13:36', len: '37,57 m', span: '35,80 m', eng: 'CFM56-5B', seats: '186' }
  };
  const EXTRA = {
  lh: { name: 'Lufthansa', country: 'Allemagne', bg: '#0A1D3D', sec: '#F9B000', fin: { base: '#1A3466', a1: 'none', a2: 'none', disc: '#F9B000' }, flight: 'LH1033', from: 'CDG', to: 'FRA', fromCity: 'Paris', toCity: 'Francfort', cities: 'Paris → Francfort', type: 'A321neo', typeFull: 'Airbus A321neo', reg: 'D-AIEA', alt: '10 400', speed: '840', cap: 'E', capDeg: '88°', dist: '61 km', dep: '13:20', arr: '14:35', prog: 22, km: '450', rarity: 'Commun', rank: 1, no: '017', seen: '11.10.26 · 13:40', count: 1, len: '44,51 m', span: '35,80 m', eng: 'CFM LEAP-1A', seats: '215' },
  kl: { name: 'KLM', country: 'Pays-Bas', bg: '#00A1DE', sec: '#003145', fin: { base: '#FFFFFF', a1: '#7FD3F2', a2: 'none', disc: 'none' }, flight: 'KL1234', from: 'AMS', to: 'BCN', fromCity: 'Amsterdam', toCity: 'Barcelone', cities: 'Amsterdam → Barcelone', type: 'E175', typeFull: 'Embraer 175', reg: 'PH-EXA', alt: '8 900', speed: '790', cap: 'S', capDeg: '184°', dist: '74 km', dep: '12:50', arr: '14:55', prog: 31, km: '1 240', rarity: 'Peu commun', rank: 2, no: '018', seen: '11.10.26 · 13:42', count: 1, len: '31,68 m', span: '26,00 m', eng: 'GE CF34-8E', seats: '88' },
  fr: { name: 'Ryanair', country: 'Irlande', bg: '#073590', sec: '#F1C933', fin: { base: '#073590', a1: '#F1C933', a2: 'none', disc: 'none' }, flight: 'FR8312', from: 'BVA', to: 'OPO', fromCity: 'Beauvais', toCity: 'Porto', cities: 'Beauvais → Porto', type: '737-800', typeFull: 'Boeing 737-800', reg: 'EI-DCL', alt: '9 800', speed: '810', cap: 'SO', capDeg: '221°', dist: '79 km', dep: '13:25', arr: '14:55', prog: 9, km: '1 210', rarity: 'Commun', rank: 1, no: '019', seen: '11.10.26 · 13:44', count: 1, len: '39,50 m', span: '35,79 m', eng: 'CFM56-7B', seats: '189' },
  xx: { name: 'Inconnue', country: 'France', bg: '#1D1D1B', sec: '#F2E8D5', fin: { base: '#CFC8BA', a1: '#1D1D1B', a2: 'none', disc: 'none' }, flight: 'F-HBXA', from: 'LIL', to: 'LBG', fromCity: 'Lille', toCity: 'Le Bourget', cities: 'Lille → Le Bourget', type: 'Jet privé', typeFull: 'Dassault Falcon 2000', reg: 'F-HBXA', alt: '3 200', speed: '520', cap: 'S', capDeg: '176°', dist: '41 km', dep: '13:30', arr: '14:05', prog: 40, km: '210', rarity: 'Rare', rank: 3, no: '020', seen: '11.10.26 · 13:46', count: 1, len: '20,23 m', span: '19,33 m', eng: 'PW308C', seats: '10' },
  vy: { name: 'Vueling', country: 'Espagne', bg: '#FFCC00', sec: '#3C3C3B', fin: { base: '#FFCC00', a1: '#3C3C3B', a2: 'none', disc: 'none' }, flight: 'VY8013', from: 'ORY', to: 'BCN', fromCity: 'Paris', toCity: 'Barcelone', cities: 'Paris → Barcelone', type: 'A321', typeFull: 'Airbus A321', reg: 'EC-MJH', alt: '7 200', speed: '760', cap: 'S', capDeg: '172°', dist: '77 km', dep: '13:15', arr: '15:00', prog: 12, km: '830', rarity: 'Commun', rank: 1, no: '021', seen: '11.10.26 · 13:48', count: 1, len: '44,51 m', span: '35,80 m', eng: 'IAE V2500', seats: '220' },
  tp: { name: 'TAP Air Portugal', country: 'Portugal', bg: '#1E6F4A', sec: '#F4F1EA', fin: { base: '#E4252F', a1: '#F4F1EA', a2: 'none', disc: 'none' }, flight: 'TP433', from: 'LIS', to: 'ORY', fromCity: 'Lisbonne', toCity: 'Paris', cities: 'Lisbonne → Paris', type: 'A320neo', typeFull: 'Airbus A320neo', reg: 'CS-TVA', alt: '11 300', speed: '850', cap: 'NE', capDeg: '32°', dist: '940 km', dep: '12:40', arr: '16:05', prog: 47, km: '1 460', rarity: 'Peu commun', rank: 2, no: '022', seen: '—', count: 0, len: '37,57 m', span: '35,80 m', eng: 'CFM LEAP-1A', seats: '174' }
};
  Object.assign(A, EXTRA);
  const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lum = h => { const [r, g, b] = hx(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  function fit(fg, bg, target) {
    if (ratio(fg, bg) >= target) return fg;
    for (let t = 0.02; t <= 0.6001; t += 0.02) {
      const l = mix(fg, '#FFFFFF', t); if (ratio(l, bg) >= target) return l;
      const d = mix(fg, '#000000', t); if (ratio(d, bg) >= target) return d;
    }
    return ratio('#F4F1EA', bg) > ratio('#1D1D1B', bg) ? '#F4F1EA' : '#1D1D1B';
  }
  function theme(k, night) {
    const a = A[k], bg = night ? mix(a.bg, '#000000', 0.4) : a.bg;
    const big = fit(a.sec, bg, 3), small = fit(a.sec, bg, 4.5);
    const tone = lum(bg) < 0.03 ? mix(bg, '#FFFFFF', 0.1) : mix(bg, '#000000', 0.16);
    const pips = [1, 2, 3, 4].map(n => ({ c: n <= a.rank ? big : mix(bg, small, 0.28) }));
    return { ...a, bg, big, small, tone, toneInk: fit(a.sec, tone, 4.5), track: mix(bg, small, 0.3), progW: a.prog + '%', img: IMG[k] || '', noImg: !IMG[k], pips, countTxt: a.count + ' fois', seenDate: a.seen.split(' · ')[0], rarityLine: a.rarity + ' · ' + a.rank + ' / 4' };
  }
  window.SKY = { A, IMG, theme, mix, fit, ORDER: ['ib', 'af', 'u2'] };
})();
