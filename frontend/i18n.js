// i18n.js: every word the farmer reads. Hindi first, English second.
// Wording rule: "latest reported" (आखिरी दर्ज भाव), never "live".

export const STRINGS = {
  hi: {
    appName: 'आज का भाव',
    tagline: 'आज मंडी में क्या भाव है?',
    pickCrop: 'फसल चुनें',
    pickState: 'अपना राज्य',
    pickDistrict: 'अपना ज़िला',
    perQuintal: 'प्रति क्विंटल',
    latestReported: 'आखिरी दर्ज भाव',
    noRate: 'भाव उपलब्ध नहीं',
    noRateOn: '{date} को इस मंडी का भाव दर्ज नहीं हुआ',
    neverReported: 'इस मंडी से इस फसल का भाव कभी दर्ज नहीं हुआ',
    oldRate: 'पुराना भाव',
    old: 'पुराना',
    up: 'बढ़ा',
    down: 'घटा',
    flat: 'कोई बदलाव नहीं',
    vsDate: '{date} के भाव से',
    noPrevious: 'तुलना के लिए पिछला भाव नहीं है',
    nearbyTitle: 'आसपास की मंडियाँ',
    nearbyHint: 'ऊँचे भाव से नीचे की ओर',
    best: 'सबसे ऊँचा',
    yourDistrict: 'आपका ज़िला',
    last7: 'पिछले 7 दिन का भाव',
    trendTitle: '{crop}: पिछले 7 दिन का भाव',
    trendUnit: 'भाव ₹ प्रति क्विंटल में',
    trendChange: '{d1} को ₹{p1}, {d2} को ₹{p2}: ₹{n} {word}',
    trendFlat: '{d1} से {d2} तक भाव वही रहा (₹{p2})',
    trendOne: 'इन 7 दिनों में सिर्फ़ एक दिन का भाव दर्ज है',
    gapNote: 'खाली दिन = भाव दर्ज नहीं हुआ',
    daysAgo: '{n} दिन पहले',
    snapshot: 'आँकड़े {date} तक के हैं',
    notLive: 'आखिरी दर्ज भाव, लाइव नहीं',
    stale: 'ध्यान दें: यह डेटा {n} दिन पुराना है ({date})। आज का भाव अलग हो सकता है।',
    offline: 'बिना नेट के चल रहा है',
    demo: 'डेमो डेटा, असली भाव नहीं',
    noRecords: 'इस ज़िले में इस फसल का कोई रिकॉर्ड नहीं',
    noRecordsHint: 'नीचे आसपास की मंडियाँ देखें',
    noNearby: 'आसपास की किसी मंडी का रिकॉर्ड नहीं',
    install: 'फ़ोन में ऐप जोड़ें',
    persistRefused: 'फ़ोन ने डेटा सेव रखने की अनुमति नहीं दी। ऐप को होम स्क्रीन पर जोड़ें।',
    source: 'स्रोत: Agmarknet, data.gov.in (भारत सरकार)',
    modalNote: 'भाव = मॉडल भाव, यानी सबसे ज़्यादा सौदे जिस भाव पर हुए।',
    loadError: 'डेटा लोड नहीं हो सका। ऐप दोबारा खोलें।',
    selectedMandi: 'मंडी',
    langName: 'हिन्दी',
    seeThis: 'इस मंडी का भाव देखें',
  },
  en: {
    appName: 'Aaj Ka Bhav',
    tagline: 'What is it selling for today?',
    pickCrop: 'Choose crop',
    pickState: 'Your state',
    pickDistrict: 'Your district',
    perQuintal: 'per quintal',
    latestReported: 'Latest reported rate',
    noRate: 'No rate reported',
    noRateOn: 'This mandi reported no rate on {date}',
    neverReported: 'This mandi has never reported this crop',
    oldRate: 'Old rate',
    old: 'Old',
    up: 'Up',
    down: 'Down',
    flat: 'No change',
    vsDate: 'vs {date}',
    noPrevious: 'No earlier rate to compare',
    nearbyTitle: 'Nearby mandis',
    nearbyHint: 'Highest rate first',
    best: 'Highest',
    yourDistrict: 'Your district',
    last7: 'Last 7 days',
    trendTitle: '{crop}: rate over the last 7 days',
    trendUnit: 'Rate in ₹ per quintal',
    trendChange: '{d1}: ₹{p1} → {d2}: ₹{p2} ({word} ₹{n})',
    trendFlat: 'Rate unchanged from {d1} to {d2} (₹{p2})',
    trendOne: 'Only one day has a reported rate in these 7 days',
    gapNote: 'Empty day = no rate reported',
    daysAgo: '{n} days ago',
    snapshot: 'Data up to {date}',
    notLive: 'Latest reported, not live',
    stale: 'Note: this data is {n} days old ({date}). Today’s rate may differ.',
    offline: 'Working offline',
    demo: 'Demo data, not real prices',
    noRecords: 'No records for this crop in this district',
    noRecordsHint: 'See nearby mandis below',
    noNearby: 'No nearby mandi has a record',
    install: 'Add app to home screen',
    persistRefused: 'The phone did not allow saved data. Add the app to your home screen.',
    source: 'Source: Agmarknet via data.gov.in (Govt. of India)',
    modalNote: 'Rate = modal price, the price most deals were made at.',
    loadError: 'Could not load data. Please reopen the app.',
    selectedMandi: 'Mandi',
    langName: 'English',
    seeThis: 'Show this mandi’s rate',
  },
};

const MONTHS = {
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  hiShort: ['जन॰', 'फ़र॰', 'मार्च', 'अप्रै॰', 'मई', 'जून', 'जुल॰', 'अग॰', 'सित॰', 'अक्टू॰', 'नव॰', 'दिस॰'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  enShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function t(lang, key, vars = {}) {
  const s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** "20 अक्टूबर" / "20 Oct". short=true uses the short month name. Input is YYYY-MM-DD. */
export function fmtDate(lang, iso, short = false) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  const table = lang === 'hi' ? (short ? MONTHS.hiShort : MONTHS.hi) : (short ? MONTHS.enShort : MONTHS.en);
  return `${d} ${table[m - 1]}`;
}

const IN = new Intl.NumberFormat('en-IN');
/** 2450 -> "2,450". Western digits with Indian grouping, the way rates appear on a phone. */
export const fmtNum = (n) => IN.format(n);
export const fmtRupee = (n) => `₹${IN.format(n)}`;
