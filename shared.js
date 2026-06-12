// ============================================================
// Shared utilities: loaded by both index.html and game.html
// ============================================================

const SUPABASE_URL      = 'https://yugrqnocdrfvpmkrddya.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xKJO3LJAlU1qkEigRBvTRg_wTlwFVjP';

// Common IANA timezone -> ISO 3166-1 alpha-2 country code
// index.html's copy is the superset; game.html had only ~12 entries
const COUNTRY_BY_TZ = {
  'Asia/Seoul':'KR','Asia/Pyongyang':'KP','Asia/Tokyo':'JP','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK',
  'Asia/Taipei':'TW','Asia/Singapore':'SG','Asia/Kuala_Lumpur':'MY','Asia/Bangkok':'TH','Asia/Jakarta':'ID',
  'Asia/Manila':'PH','Asia/Ho_Chi_Minh':'VN','Asia/Saigon':'VN','Asia/Kolkata':'IN','Asia/Calcutta':'IN',
  'Asia/Dubai':'AE','Asia/Riyadh':'SA','Asia/Tehran':'IR','Asia/Karachi':'PK','Asia/Dhaka':'BD',
  'Asia/Yangon':'MM','Asia/Rangoon':'MM','Asia/Almaty':'KZ','Asia/Tashkent':'UZ','Asia/Yekaterinburg':'RU',
  'Europe/London':'GB','Europe/Dublin':'IE','Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Madrid':'ES',
  'Europe/Rome':'IT','Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Lisbon':'PT','Europe/Vienna':'AT',
  'Europe/Zurich':'CH','Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Copenhagen':'DK','Europe/Helsinki':'FI',
  'Europe/Warsaw':'PL','Europe/Prague':'CZ','Europe/Budapest':'HU','Europe/Athens':'GR','Europe/Bucharest':'RO',
  'Europe/Sofia':'BG','Europe/Moscow':'RU','Europe/Istanbul':'TR','Europe/Kiev':'UA','Europe/Kyiv':'UA',
  'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Los_Angeles':'US',
  'America/Phoenix':'US','America/Anchorage':'US','America/Adak':'US','America/Honolulu':'US',
  'America/Toronto':'CA','America/Vancouver':'CA','America/Edmonton':'CA','America/Halifax':'CA',
  'America/Mexico_City':'MX','America/Tijuana':'MX','America/Sao_Paulo':'BR','America/Rio_Branco':'BR',
  'America/Buenos_Aires':'AR','America/Argentina/Buenos_Aires':'AR','America/Santiago':'CL','America/Lima':'PE',
  'America/Bogota':'CO','America/Caracas':'VE','America/Havana':'CU','America/Panama':'PA',
  'Africa/Cairo':'EG','Africa/Johannesburg':'ZA','Africa/Lagos':'NG','Africa/Nairobi':'KE','Africa/Casablanca':'MA',
  'Africa/Algiers':'DZ','Africa/Tunis':'TN','Africa/Accra':'GH','Africa/Addis_Ababa':'ET',
  'Australia/Sydney':'AU','Australia/Melbourne':'AU','Australia/Brisbane':'AU','Australia/Perth':'AU',
  'Australia/Adelaide':'AU','Pacific/Auckland':'NZ','Pacific/Honolulu':'US','Pacific/Fiji':'FJ'
};

const COUNTRY_NAMES = {
  KR:'South Korea',KP:'North Korea',JP:'Japan',CN:'China',HK:'Hong Kong',TW:'Taiwan',SG:'Singapore',
  MY:'Malaysia',TH:'Thailand',ID:'Indonesia',PH:'Philippines',VN:'Vietnam',IN:'India',AE:'UAE',
  SA:'Saudi Arabia',IR:'Iran',PK:'Pakistan',BD:'Bangladesh',MM:'Myanmar',KZ:'Kazakhstan',UZ:'Uzbekistan',
  GB:'United Kingdom',IE:'Ireland',FR:'France',DE:'Germany',ES:'Spain',IT:'Italy',NL:'Netherlands',
  BE:'Belgium',PT:'Portugal',AT:'Austria',CH:'Switzerland',SE:'Sweden',NO:'Norway',DK:'Denmark',
  FI:'Finland',PL:'Poland',CZ:'Czechia',HU:'Hungary',GR:'Greece',RO:'Romania',BG:'Bulgaria',
  RU:'Russia',TR:'Turkey',UA:'Ukraine',US:'United States',CA:'Canada',MX:'Mexico',BR:'Brazil',
  AR:'Argentina',CL:'Chile',PE:'Peru',CO:'Colombia',VE:'Venezuela',CU:'Cuba',PA:'Panama',
  EG:'Egypt',ZA:'South Africa',NG:'Nigeria',KE:'Kenya',MA:'Morocco',DZ:'Algeria',TN:'Tunisia',
  GH:'Ghana',ET:'Ethiopia',AU:'Australia',NZ:'New Zealand',FJ:'Fiji'
};

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && COUNTRY_BY_TZ[tz]) return COUNTRY_BY_TZ[tz];
  } catch (e) {}
  try {
    const lang = (navigator.language || '').toUpperCase();
    const m = lang.match(/-([A-Z]{2})$/);
    if (m && COUNTRY_NAMES[m[1]]) return m[1];
    if (COUNTRY_NAMES[lang]) return lang;
  } catch (e) {}
  return 'US';
}

function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return '🏳️';
  const A_BASE = 0x1F1E6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(cc.charCodeAt(0) + A_BASE) + String.fromCodePoint(cc.charCodeAt(1) + A_BASE);
}

// game.html's escapeHtml handles null/undefined; take that as the more complete version
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]
  ));
}

function generatePlayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
