import type { Locale } from "@/lib/i18n/types";

export type PrivacyCopy = {
  title: string;
  versionLine: (version: string, shopName: string) => string;
  sections: Array<{ heading: string; body: string | string[] }>;
  backLink: string;
  contactMissing: string;
  contactIntro: string;
};

const en: PrivacyCopy = {
  title: "Privacy notice",
  versionLine: (version, shopName) =>
    `Version ${version} · Applies to the feedback page for ${shopName}`,
  backLink: "Back to the feedback page",
  contactMissing: "Contact details are not configured for this deployment yet.",
  contactIntro:
    "Questions about this notice, a request to access or delete feedback, or to withdraw follow-up consent:",
  sections: [
    {
      heading: "Who is responsible",
      body: "The shop named on this page is the data fiduciary for feedback you share here. Hosting and storage are provided by Supabase. Optional rate limiting may use Upstash with a short-lived network address. AI drafting uses NVIDIA NIM as the primary provider and Google Gemini as a fallback — both may process text outside India.",
    },
    {
      heading: "What we don’t collect by default",
      body: "No account or Google login is required. We do not ask for your name or email unless you later choose a follow-up. Device fingerprints are not stored in our database.",
    },
    {
      heading: "What we process",
      body: [
        "Star rating (1–5).",
        "Optional improvement topics you select.",
        "Optional free-text comments you write.",
        "Which version of this notice you were shown, and when.",
        "A public deletion reference returned after you submit.",
        "If you opt in: a phone number solely to follow up about this feedback.",
        "Anonymous analytics event names (for example page opened) without linking them to your text.",
      ],
    },
    {
      heading: "Purpose",
      body: "Private feedback helps the shop improve service. AI drafting is only to help you edit a public review in your browser. Follow-up contact happens only with your explicit consent and only about the feedback you shared.",
    },
    {
      heading: "AI-assisted drafting",
      body: "If you ask for help writing a review, your rating, topics, and comments are sent transiently to NVIDIA NIM and/or Google Gemini. Drafts are returned to your browser and are never stored by this website.",
    },
    {
      heading: "Google reviews",
      body: "Posting on Google is entirely optional and happens on Google’s site under your account. We never post for you and cannot see whether you published.",
    },
    {
      heading: "How long we keep it",
      body: [
        "Private feedback (including topics, reference, and any follow-up phone): up to 180 days, then deleted automatically.",
        "Anonymous usage counts: up to 90 days.",
        "Generated review drafts: never stored.",
      ],
    },
    {
      heading: "Your rights (India DPDP)",
      body: "You may request access, correction, or erasure of feedback you shared, and you may withdraw follow-up consent. Quote the deletion reference shown after submit when you contact us. We aim to respond within a reasonable period. You may also raise a grievance with the shop contact below.",
    },
  ],
};

const hi: PrivacyCopy = {
  title: "गोपनीयता सूचना",
  versionLine: (version, shopName) =>
    `संस्करण ${version} · ${shopName} के फीडबैक पेज पर लागू`,
  backLink: "फीडबैक पेज पर वापस जाएँ",
  contactMissing: "इस परिनियोजन के लिए संपर्क विवरण अभी सेट नहीं है।",
  contactIntro:
    "इस सूचना, फीडबैक देखने/मिटाने, या फ़ॉलो-अप सहमति वापस लेने के बारे में:",
  sections: [
    {
      heading: "ज़िम्मेदारी किसकी है",
      body: "इस पेज पर नामित दुकान डेटा फिड्यूशरी है। होस्टिंग Supabase पर है। वैकल्पिक रेट लिमिटिंग Upstash का उपयोग कर सकती है। AI ड्राफ्टिंग में NVIDIA NIM (प्राथमिक) और Google Gemini (फ़ॉलबैक) का उपयोग होता है — दोनों भारत के बाहर प्रोसेस कर सकते हैं।",
    },
    {
      heading: "डिफ़ॉल्ट रूप से हम क्या नहीं लेते",
      body: "कोई खाता या Google लॉगिन ज़रूरी नहीं। नाम या ईमेल तब तक नहीं माँगा जाता जब तक आप फ़ॉलो-अप न चुनें। डिवाइस फिंगरप्रिंट डेटाबेस में नहीं रखा जाता।",
    },
    {
      heading: "हम क्या प्रोसेस करते हैं",
      body: [
        "स्टार रेटिंग (1–5)।",
        "वैकल्पिक सुधार विषय।",
        "वैकल्पिक लिखित टिप्पणी।",
        "आपको दिखाई गई सूचना का संस्करण और समय।",
        "सबमिट के बाद दिया गया हटाने का संदर्भ।",
        "यदि आप सहमत हों: केवल इसी फीडबैक के फ़ॉलो-अप के लिए फ़ोन नंबर।",
        "अनाम एनालिटिक्स इवेंट नाम (पाठ से लिंक नहीं)।",
      ],
    },
    {
      heading: "उद्देश्य",
      body: "निजी फीडबैक सेवा सुधारने में मदद करता है। AI ड्राफ्ट केवल आपके ब्राउज़र में सार्वजनिक समीक्षा लिखने में मदद के लिए है। फ़ॉलो-अप केवल स्पष्ट सहमति से और केवल आपके फीडबैक के बारे में होता है।",
    },
    {
      heading: "AI सहायता",
      body: "समीक्षा लिखने में मदद माँगने पर रेटिंग, विषय और टिप्पणी अस्थायी रूप से NVIDIA NIM और/या Google Gemini को भेजी जाती है। ड्राफ्ट आपके ब्राउज़र में लौटता है और इस वेबसाइट पर संग्रहीत नहीं होता।",
    },
    {
      heading: "Google समीक्षाएँ",
      body: "Google पर पोस्ट करना पूरी तरह वैकल्पिक है और आपके खाते से Google की साइट पर होता है। हम आपकी ओर से पोस्ट नहीं करते।",
    },
    {
      heading: "कितने समय तक रखते हैं",
      body: [
        "निजी फीडबैक: अधिकतम 180 दिन, फिर स्वतः हटाया जाता है।",
        "अनाम उपयोग गणना: अधिकतम 90 दिन।",
        "समीक्षा ड्राफ्ट: कभी संग्रहीत नहीं।",
      ],
    },
    {
      heading: "आपके अधिकार (भारत DPDP)",
      body: "आप साझा फीडबैक तक पहुँच, सुधार या मिटाने का अनुरोध कर सकते हैं और फ़ॉलो-अप सहमति वापस ले सकते हैं। संपर्क करते समय सबमिट के बाद दिखाया गया संदर्भ बताएँ। आप नीचे दिए संपर्क पर शिकायत भी दर्ज करा सकते हैं।",
    },
  ],
};

const gu: PrivacyCopy = {
  title: "ગોપનીયતા સૂચના",
  versionLine: (version, shopName) =>
    `સંસ્કરણ ${version} · ${shopName} ના ફીડબેક પેજ પર લાગુ`,
  backLink: "ફીડબેક પેજ પર પાછા જાઓ",
  contactMissing: "આ ડિપ્લોયમેન્ટ માટે સંપર્ક વિગતો હજુ સેટ નથી.",
  contactIntro:
    "આ સૂચના, ફીડબેક જોવા/કાઢી નાખવા, અથવા ફૉલો-અપ સંમતિ પાછી ખેંચવા વિશે:",
  sections: [
    {
      heading: "જવાબદારી કોની છે",
      body: "આ પેજ પર નામવાળી દુકાન ડેટા ફિડ્યુશિયરી છે. હોસ્ટિંગ Supabase પર છે. વૈકલ્પિક રેટ લિમિટિંગ Upstash વાપરી શકે. AI ડ્રાફ્ટિંગમાં NVIDIA NIM (પ્રાથમિક) અને Google Gemini (ફૉલબૅક) વપરાય છે — બંને ભારત બહાર પ્રોસેસ કરી શકે.",
    },
    {
      heading: "ડિફૉલ્ટ રીતે અમે શું એકત્રિત નથી કરતા",
      body: "કોઈ એકાઉન્ટ અથવા Google લૉગિન જરૂરી નથી. નામ કે ઇમેઇલ ત્યાં સુધી નથી માગતા જ્યાં સુધી તમે ફૉલો-અપ ન પસંદ કરો. ડિવાઇસ ફિંગરપ્રિન્ટ ડેટાબેઝમાં સંગ્રહાતું નથી.",
    },
    {
      heading: "અમે શું પ્રોસેસ કરીએ છીએ",
      body: [
        "સ્ટાર રેટિંગ (1–5).",
        "વૈકલ્પિક સુધારાના વિષયો.",
        "વૈકલ્પિક લેખિત ટિપ્પણી.",
        "તમને બતાવેલી સૂચનાનું સંસ્કરણ અને સમય.",
        "સબમિટ પછી આપેલો કાઢી નાખવાનો સંદર્ભ.",
        "જો તમે સંમત થાઓ: ફક્ત આ ફીડબેકના ફૉલો-અપ માટે ફોન નંબર.",
        "અનામી એનાલિટિક્સ ઇવેન્ટ નામો (લખાણ સાથે લિંક નહીં).",
      ],
    },
    {
      heading: "હેતુ",
      body: "ખાનગી ફીડબેક સેવા સુધારવામાં મદદ કરે છે. AI ડ્રાફ્ટ ફક્ત તમારા બ્રાઉઝરમાં જાહેર સમીક્ષા લખવામાં મદદ માટે છે. ફૉલો-અપ ફક્ત સ્પષ્ટ સંમતિ સાથે અને ફક્ત તમારા ફીડબેક અંગે થાય છે.",
    },
    {
      heading: "AI સહાય",
      body: "સમીક્ષા લખવામાં મદદ માગો તો રેટિંગ, વિષયો અને ટિપ્પણી કામચલાઉ રીતે NVIDIA NIM અને/અથવા Google Geminiને મોકલાય છે. ડ્રાફ્ટ તમારા બ્રાઉઝરમાં પાછો આવે છે અને આ વેબસાઇટ પર સંગ્રહાતો નથી.",
    },
    {
      heading: "Google સમીક્ષાઓ",
      body: "Google પર પોસ્ટ કરવું સંપૂર્ણપણે વૈકલ્પિક છે અને તમારા એકાઉન્ટથી Googleની સાઇટ પર થાય છે. અમે તમારી વતી પોસ્ટ નથી કરતા.",
    },
    {
      heading: "કેટલા સમય સુધી રાખીએ છીએ",
      body: [
        "ખાનગી ફીડબેક: વધુમાં વધુ 180 દિવસ, પછી આપમેળે કાઢી નાખાય.",
        "અનામી ઉપયોગ ગણતરી: વધુમાં વધુ 90 દિવસ.",
        "સમીક્ષા ડ્રાફ્ટ: ક્યારેય સંગ્રહાતા નથી.",
      ],
    },
    {
      heading: "તમારા અધિકારો (ભારત DPDP)",
      body: "તમે શેર કરેલા ફીડબેકની ઍક્સેસ, સુધારો અથવા કાઢી નાખવાની વિનંતી કરી શકો અને ફૉલો-અપ સંમતિ પાછી ખેંચી શકો. સંપર્ક કરતી વખતે સબમિટ પછી બતાવેલો સંદર્ભ જણાવો. નીચેના સંપર્ક પર ફરિયાદ પણ નોંધાવી શકો.",
    },
  ],
};

const CATALOG: Record<Locale, PrivacyCopy> = { en, hi, gu };

export function getPrivacyCopy(locale: Locale): PrivacyCopy {
  return CATALOG[locale] ?? en;
}
