/**
 * Bilingual education content for the landing page and the member library.
 *
 * Source: the Philippine Red Cross Safe Card Member Guide 2026, the Safe Card
 * FAQs and the Safe Card Program Overview. Amounts, deadlines, waiting
 * periods and exclusions are copied from those documents; they are not
 * paraphrased into new promises. The plain-language wording is a summary and
 * every section tells the reader that the insurance policy decides.
 *
 * Filipino text is a translation draft until PRC approves it. English is the
 * reference. Keys exist in both languages for every entry; a unit test keeps
 * it that way and keeps pilot, demo and validation wording out of public copy.
 */

export type Locale = "fil" | "en";
export interface Localized { en: string; fil: string }

export function pick(value: Localized, locale: Locale): string {
  return value[locale];
}

export interface IndexLink { id: string; label: Localized }

/** Order matches the page. `benefits` and `process` keep the ids the site header already links to. */
export const sectionIndex: readonly IndexLink[] = [
  { id: "benefits", label: { en: "What you get", fil: "Ang makukuha mo" } },
  { id: "covered", label: { en: "Is it covered?", fil: "Sakop ba?" } },
  { id: "accident", label: { en: "After an accident", fil: "Kapag may aksidente" } },
  { id: "process", label: { en: "How to join", fil: "Paano sumali" } },
  { id: "faq", label: { en: "Questions", fil: "Mga tanong" } },
  { id: "downloads", label: { en: "Downloads", fil: "Mga download" } },
] as const;

export const heroFacts: readonly Localized[] = [
  { en: "₱1,200 a year", fil: "₱1,200 kada taon" },
  { en: "Ages 3 to 85", fil: "Edad 3 hanggang 85" },
  { en: "Valid for 1 year", fil: "Bisa ng 1 taon" },
  { en: "Cannot be transferred", fil: "Hindi maaaring ilipat" },
] as const;

// ---------------------------------------------------------------- What you get
export interface BenefitTile {
  id: string;
  /** Visual shown beside the amount. `image` files live in public/images/education. */
  visual: { kind: "image"; src: string; width: number; height: number } | { kind: "icon"; name: "shield-alert" | "receipt" | "heart" | "bed" };
  amount: Localized;
  text: Localized;
  note?: Localized;
}

export const whatYouGet = {
  eyebrow: { en: "What you get", fil: "Ang makukuha mo" },
  title: { en: "Money for you or your family after an accident. Red Cross help on the spot.", fil: "Pera para sa iyo o sa pamilya mo pagkatapos ng aksidente. Agarang tulong mula sa Red Cross." },
  intro: { en: "Two different groups give you two different kinds of help.", fil: "Dalawang magkaibang grupo ang nagbibigay ng dalawang uri ng tulong." },
  examples: { en: "See how each benefit works in real situations", fil: "Tingnan kung paano gumagana ang bawat benepisyo sa totoong sitwasyon" },
  insurance: {
    title: { en: "Money from the insurance company", fil: "Pera mula sa insurance company" },
    subtitle: { en: "Paid by Prudential Guarantee (PGAI) once your claim is approved.", fil: "Babayaran ng Prudential Guarantee (PGAI) kapag naaprubahan ang claim mo." },
    tiles: [
      { id: "death-disability", visual: { kind: "image", src: "/images/education/protected-member.webp", width: 299, height: 300 }, amount: { en: "₱300,000", fil: "₱300,000" }, text: { en: "If an accident causes death, disability, or the loss of a body part", fil: "Kapag ang aksidente ay nagdulot ng pagkamatay, kapansanan, o pagkawala ng bahagi ng katawan" } },
      { id: "assault", visual: { kind: "icon", name: "shield-alert" }, amount: { en: "₱300,000", fil: "₱300,000" }, text: { en: "If you die from an attack with no reason behind it", fil: "Kapag namatay ka dahil sa pag-atakeng walang dahilan" } },
      { id: "medical", visual: { kind: "icon", name: "receipt" }, amount: { en: "₱10,000", fil: "₱10,000" }, text: { en: "Pays back your hospital and medicine bills after an accident", fil: "Ibinabalik ang bayad mo sa ospital at gamot pagkatapos ng aksidente" }, note: { en: "Per accident", fil: "Kada aksidente" } },
      { id: "burial", visual: { kind: "icon", name: "heart" }, amount: { en: "₱5,000", fil: "₱5,000" }, text: { en: "Helps your family pay for the burial after an accident", fil: "Tulong sa pamilya mo para sa libing pagkatapos ng aksidente" } },
      { id: "hospital", visual: { kind: "icon", name: "bed" }, amount: { en: "₱200 a day", fil: "₱200 kada araw" }, text: { en: "For each day you stay in the hospital, up to 60 days", fil: "Para sa bawat araw mo sa ospital, hanggang 60 araw" }, note: { en: "You must stay at least 24 hours.", fil: "Kailangang hindi bababa sa 24 oras ang pananatili mo." } },
    ] as readonly BenefitTile[],
    footnote: { en: "The insurance company checks every claim and decides whether it is paid. The Red Cross helps you send it in.", fil: "Sinusuri ng insurance company ang bawat claim at sila ang nagpapasya kung babayaran ito. Tutulungan ka ng Red Cross na maipasa ito." },
  },
  services: {
    title: { en: "Help on the spot from the Red Cross", fil: "Agarang tulong mula sa Red Cross" },
    subtitle: { en: "For accidents. Call 143.", fil: "Para sa aksidente. Tumawag sa 143." },
    tiles: [
      { id: "ambulance", visual: { kind: "image", src: "/images/education/ambulance.webp", width: 321, height: 222 }, amount: { en: "1 ambulance ride", fil: "1 sakay sa ambulansya" }, text: { en: "To the nearest hospital after an accident", fil: "Papunta sa pinakamalapit na ospital pagkatapos ng aksidente" } },
      { id: "blood", visual: { kind: "image", src: "/images/education/blood-bag.webp", width: 255, height: 222 }, amount: { en: "1 unit of blood", fil: "1 unit ng dugo" }, text: { en: "For needs caused by an accident. Apheresis products are not included.", fil: "Para sa pangangailangang dulot ng aksidente. Hindi kasama ang apheresis products." } },
    ] as readonly BenefitTile[],
    footnote: { en: "This is a Red Cross service, not insurance. It depends on what is available near you, so we cannot promise how fast help will arrive.", fil: "Serbisyo ito ng Red Cross, hindi insurance. Depende ito sa availability malapit sa iyo, kaya hindi namin maipapangako kung gaano kabilis darating ang tulong." },
  },
} as const;

// ----------------------------------------------------------------- Is it covered
export interface CoverageItem { title: Localized; text: Localized }

export const coverage = {
  eyebrow: { en: "Is it covered?", fil: "Sakop ba?" },
  title: { en: "What is covered, and what is not.", fil: "Ano ang sakop, at ano ang hindi." },
  intro: { en: "Here is the short version, in plain words.", fil: "Narito ang maikling bersyon, sa simpleng salita." },
  covered: { title: { en: "Covered", fil: "Sakop" }, items: [
    { title: { en: "Vehicle accidents", fil: "Aksidente sa sasakyan" }, text: { en: "Accidents on the road.", fil: "Mga aksidente sa kalsada." } },
    { title: { en: "Motorcycle accidents", fil: "Aksidente sa motorsiklo" }, text: { en: "Covered if you are not racing and have no LTO violation.", fil: "Sakop kung hindi ka nagkakarera at walang paglabag sa LTO." } },
    { title: { en: "Riding as a passenger", fil: "Pagsakay bilang pasahero" }, text: { en: "By land, air, or sea, when you pay the fare.", fil: "Sa lupa, hangin, o dagat, kapag nagbabayad ka ng pamasahe." } },
    { title: { en: "Typhoon, flood, and other disasters", fil: "Bagyo, baha, at iba pang sakuna" }, text: { en: "Includes earthquake, volcanic eruption, landslide, lightning, and tidal wave.", fil: "Kasama ang lindol, pagsabog ng bulkan, landslide, kidlat, at tidal wave." } },
    { title: { en: "Accidents at home", fil: "Aksidente sa bahay" }, text: { en: "Home and household accidents.", fil: "Mga aksidente sa bahay at sambahayan." } },
    { title: { en: "Animal bites", fil: "Kagat ng hayop" }, text: { en: "Covers your medical bills.", fil: "Sakop ang gastusin mo sa pagpapagamot." } },
  ] as readonly CoverageItem[] },
  notCovered: { title: { en: "Not covered", fil: "Hindi sakop" }, items: [
    { title: { en: "Racing and risky sports", fil: "Karera at mapanganib na isport" }, text: { en: "Any kind of racing, and sports such as scuba diving or boxing.", fil: "Anumang uri ng karera, at mga isport tulad ng scuba diving o boksing." } },
    { title: { en: "Alcohol or drugs", fil: "Alak o droga" }, text: { en: "Accidents while drunk or on drugs a doctor did not prescribe.", fil: "Mga aksidenteng nangyari habang lasing o gumagamit ng gamot na hindi inireseta ng doktor." } },
    { title: { en: "Hurting yourself", fil: "Pananakit sa sarili" }, text: { en: "Injury you cause to yourself on purpose.", fil: "Pinsalang sinadya mong idulot sa sarili." } },
    { title: { en: "Pregnancy problems", fil: "Problema sa pagbubuntis" }, text: { en: "Childbirth, miscarriage, and other pregnancy complications.", fil: "Panganganak, pagkakunan, at iba pang komplikasyon sa pagbubuntis." } },
    { title: { en: "Taking part in a crime", fil: "Pakikilahok sa krimen" }, text: { en: "Willingly taking part in a crime.", fil: "Kusang pakikilahok sa krimen." } },
    { title: { en: "Dangerous jobs", fil: "Mapanganib na trabaho" }, text: { en: "Not covered if the accident is work-related, for jobs such as mining, firefighting, or police work.", fil: "Hindi sakop kung kaugnay ng trabaho ang aksidente, sa mga trabahong tulad ng pagmimina, pagbubumbero, o pagpupulis." } },
  ] as readonly CoverageItem[] },
  note: { en: "This is a summary and does not list every case. The insurance policy wording decides.", fil: "Buod ito at hindi nito nalilista ang lahat ng kaso. Ang nakasulat sa polisiya ang masusunod." },
  wait: {
    title: { en: "When can you claim?", fil: "Kailan ka maaaring mag-claim?" },
    intro: { en: "Some claims open only after you have been a member for a while. Your start date is on your membership ID.", fil: "Ang ilang claim ay mabubuksan lamang pagkaraan ng ilang panahon bilang member. Nasa membership ID mo ang start date mo." },
    cards: [
      { id: "day-1", figure: { en: "Day 1", fil: "Unang araw" }, text: { en: "Accidents are covered from your start date.", fil: "Sakop ang mga aksidente mula sa start date mo." } },
      { id: "day-30", figure: { en: "30 days", fil: "30 araw" }, text: { en: "Dengue and illness-related claims can start after your first 30 days.", fil: "Maaari nang magsimula ang claim para sa dengue at sakit pagkatapos ng unang 30 araw mo." } },
      { id: "month-6", figure: { en: "6 months", fil: "6 na buwan" }, text: { en: "Hospital allowance for a condition you already had starts after 6 months.", fil: "Magsisimula ang hospital allowance para sa dati nang kondisyon pagkatapos ng 6 na buwan." } },
    ] as readonly { id: string; figure: Localized; text: Localized }[],
  },
} as const;

// -------------------------------------------------------------- After an accident
export const accident = {
  eyebrow: { en: "After an accident", fil: "Kapag may aksidente" },
  title: { en: "Three things to do. Two deadlines.", fil: "Tatlong gagawin. Dalawang deadline." },
  call: { title: { en: "Call 143 right away", fil: "Tumawag agad sa 143" }, text: { en: "Tell the operator you are a Safe Card holder. Give your card number and say what happened.", fil: "Sabihin sa operator na Safe Card holder ka. Ibigay ang card number mo at sabihin kung ano ang nangyari." }, action: { en: "Call 143", fil: "Tumawag sa 143" } },
  steps: [
    { id: "call", when: { en: "Day 0", fil: "Araw 0" }, title: { en: "Call 143", fil: "Tumawag sa 143" }, text: { en: "Ask for an ambulance or blood.", fil: "Humingi ng ambulansya o dugo." }, deadline: false },
    { id: "notify", when: { en: "By day 30", fil: "Sa loob ng 30 araw" }, title: { en: "Tell the Red Cross", fil: "Ipaalam sa Red Cross" }, text: { en: "Text 0917 844 6025 or email maabclaims@redcross.org.ph.", fil: "Mag-text sa 0917 844 6025 o mag-email sa maabclaims@redcross.org.ph." }, deadline: true },
    { id: "submit", when: { en: "By day 60", fil: "Sa loob ng 60 araw" }, title: { en: "Hand in your documents", fil: "Ipasa ang mga dokumento mo" }, text: { en: "Take them to the nearest Red Cross chapter. Count 60 days from the accident, or from hospital discharge.", fil: "Dalhin sa pinakamalapit na chapter ng Red Cross. Bilangin ang 60 araw mula sa aksidente, o mula sa paglabas sa ospital." }, deadline: true },
    { id: "decide", when: { en: "Then", fil: "Pagkatapos" }, title: { en: "The insurer decides", fil: "Magpapasya ang insurer" }, text: { en: "Prudential Guarantee (PGAI) reviews your claim.", fil: "Susuriin ng Prudential Guarantee (PGAI) ang claim mo." }, deadline: false },
  ] as readonly { id: string; when: Localized; title: Localized; text: Localized; deadline: boolean }[],
  documents: {
    title: { en: "What to bring", fil: "Ano ang dadalhin" },
    intro: { en: "The chapter gives you the claim form. The insurer may ask for more papers.", fil: "Ibibigay sa iyo ng chapter ang claim form. Maaaring humingi pa ng ibang papeles ang insurer." },
    hospital: { title: { en: "For hospital bills and daily allowance", fil: "Para sa bayad sa ospital at daily allowance" }, items: [{ en: "Copy of your membership ID", fil: "Kopya ng membership ID mo" }, { en: "Medical certificate (original)", fil: "Medical certificate (orihinal)" }, { en: "Hospital statement of account and records", fil: "Hospital statement of account at records" }, { en: "Doctor's prescriptions", fil: "Reseta ng doktor" }, { en: "Original receipts that list each item", fil: "Orihinal na resibo na may listahan ng bawat item" }, { en: "Police report or a witness statement", fil: "Police report o salaysay ng saksi" }] as readonly Localized[] },
    death: { title: { en: "For a death claim", fil: "Para sa death claim" }, items: [{ en: "The papers on the left, where they apply", fil: "Ang mga papeles sa kaliwa, kung naaangkop" }, { en: "Death certificate", fil: "Death certificate" }, { en: "Birth certificates of the member and beneficiaries", fil: "Birth certificate ng member at ng mga beneficiary" }, { en: "Marriage contract, if married", fil: "Marriage contract, kung may asawa" }, { en: "Burial receipts", fil: "Mga resibo ng libing" }] as readonly Localized[] },
  },
} as const;

// ------------------------------------------------------------------- How to join
/** Added under the existing process timeline. */
export const joinNote: Localized = {
  en: "Paying does not start your membership. It starts only when the Red Cross confirms it.",
  fil: "Hindi nagsisimula ang membership mo dahil lang nagbayad ka. Magsisimula ito kapag kinumpirma ng Red Cross.",
};

// --------------------------------------------------------------------------- FAQ
export interface FaqItem {
  id: string;
  question: Localized;
  answer: readonly Localized[];
  /** Words people type that the question itself does not contain ("lost", "expire", "nawala"). Searched, never shown. */
  keywords?: Localized;
  /** Points to the section that explains it in full. `member` is used inside the member library. */
  more?: { landing: string; member: string; label: Localized };
}

export const faq = {
  eyebrow: { en: "Questions", fil: "Mga tanong" },
  title: { en: "Quick answers.", fil: "Mabilis na sagot." },
  searchLabel: { en: "Search the questions", fil: "Hanapin sa mga tanong" },
  searchPlaceholder: { en: "Search, for example “lost card”", fil: "Maghanap, hal. “nawalang card”" },
  noMatch: {
    en: "Nothing matches. Call 143 or email members@redcross.org.ph.",
    fil: "Walang tugma. Tumawag sa 143 o mag-email sa members@redcross.org.ph.",
  },
  resultsOne: { en: "1 question shown", fil: "1 tanong ang ipinapakita" },
  resultsMany: { en: "questions shown", fil: "tanong ang ipinapakita" },
  download: { en: "Download the FAQ brochure (PDF)", fil: "I-download ang FAQ brochure (PDF)" },
  items: [
    {
      id: "what-is",
      question: { en: "What is the Safe Card membership program?", fil: "Ano ang Safe Card membership program?" },
      answer: [{
        en: "It is a yearly Philippine Red Cross membership. It lets you take part in the Red Cross's life-saving work, such as rescue and relief in disasters, ambulance service, and safe blood for people in need. It also comes with ambulance, blood and accident-related benefits.",
        fil: "Isa itong taunang membership sa Philippine Red Cross. Sa pamamagitan nito, nakikibahagi ka sa mga serbisyong nagliligtas-buhay ng Red Cross, tulad ng pagsagip at pagtulong sa panahon ng sakuna, serbisyo ng ambulansya, at ligtas na dugo para sa mga nangangailangan. May kasama rin itong benepisyo sa ambulansya, dugo, at mga aksidente.",
      }],
    },
    {
      id: "price",
      keywords: { en: "cost fee price how much payment pay amount", fil: "presyo bayad halaga magkano gastos" },
      question: { en: "How much is the Safe Card?", fil: "Magkano ang Safe Card?" },
      answer: [{ en: "₱1,200. It is valid for 1 year from the time it is activated.", fil: "₱1,200. Bisa ito ng 1 taon mula nang ma-activate." }],
    },
    {
      id: "who",
      keywords: { en: "age old young child senior eligible eligibility foreigner foreign", fil: "edad bata matanda senior karapat-dapat dayuhan" },
      question: { en: "Who can get a Safe Card?", fil: "Sino ang maaaring kumuha ng Safe Card?" },
      answer: [{
        en: "Anyone living in the Philippines who is 3 to 85 years old, including foreigners who live here.",
        fil: "Sinumang nakatira sa Pilipinas na edad 3 hanggang 85, kasama ang mga dayuhang nakatira dito.",
      }],
    },
    {
      id: "transfer",
      keywords: { en: "share lend give pass assign family member someone", fil: "ibahagi ipasa ipahiram ibigay pamilya iba" },
      question: { en: "Can I give my card to someone else?", fil: "Maaari ko bang ibigay sa iba ang card ko?" },
      answer: [{
        en: "No. The membership belongs to one person and cannot be shared or passed on.",
        fil: "Hindi. Para sa isang tao lamang ang membership at hindi ito maaaring ibahagi o ipasa.",
      }],
    },
    {
      id: "benefits",
      keywords: { en: "coverage covered insurance amount limit ambulance blood hospital", fil: "saklaw sakop insurance halaga limitasyon ambulansya dugo ospital" },
      question: { en: "What are the benefits of a Safe Card?", fil: "Ano ang mga benepisyo ng Safe Card?" },
      answer: [{
        en: "Money from the insurer after an accident, up to ₱300,000, plus 1 ambulance service and 1 unit of blood from the Red Cross for accidents. Limits, conditions and availability apply.",
        fil: "Pera mula sa insurer pagkatapos ng aksidente, hanggang ₱300,000, at 1 serbisyo ng ambulansya at 1 unit ng dugo mula sa Red Cross para sa mga aksidente. May mga limitasyon, kondisyon, at availability na dapat tuparin.",
      }],
      more: {
        landing: "#benefits",
        member: "/member/library/guide#benefits",
        label: { en: "See every benefit", fil: "Tingnan ang lahat ng benepisyo" },
      },
    },
    {
      id: "fee-use",
      keywords: { en: "money contribution donation", fil: "pera kontribusyon donasyon" },
      question: { en: "Where does my ₱1,200 go?", fil: "Saan napupunta ang ₱1,200 ko?" },
      answer: [{
        en: "It helps the Philippine Red Cross give emergency and medical support during disasters and emergencies.",
        fil: "Tumutulong ito sa Philippine Red Cross na magbigay ng emergency at medikal na suporta sa panahon ng sakuna at emergency.",
      }],
    },
    {
      id: "why",
      question: { en: "Why should I become a member?", fil: "Bakit ako dapat maging member?" },
      answer: [{
        en: "You get personal protection and you support a good cause. Your membership helps the Philippine Red Cross continue its life-saving work in disaster response, health services, blood donation, and emergency rescue.",
        fil: "Nakakakuha ka ng personal na proteksyon at sumusuporta ka sa mabuting layunin. Tinutulungan ng membership mo ang Philippine Red Cross na ipagpatuloy ang gawaing nagliligtas-buhay nito sa pagtugon sa sakuna, serbisyong pangkalusugan, donasyon ng dugo, at emergency rescue.",
      }],
    },
    {
      id: "accidents-reimbursed",
      keywords: { en: "dengue animal bite typhoon flood earthquake covered list", fil: "dengue kagat hayop bagyo baha lindol sakop listahan" },
      question: {
        en: "Which accidents can I claim medical reimbursement for?",
        fil: "Aling mga aksidente ang maaari kong i-claim para sa medical reimbursement?",
      },
      answer: [{
        en: "Acts of nature (typhoon, earthquake, flood, landslide, lightning strike, volcanic eruption and tidal wave), animal bites, dengue, and vehicle, domestic, home and household accidents.",
        fil: "Mga sakuna ng kalikasan (bagyo, lindol, baha, landslide, tama ng kidlat, pagsabog ng bulkan, at tidal wave), kagat ng hayop, dengue, at aksidente sa sasakyan, sa tahanan, at sa sambahayan.",
      }],
    },
    {
      id: "renew",
      keywords: { en: "renewal expire expiry expires extend again next year", fil: "renewal mag-renew mag-expire matapos susunod na taon" },
      question: { en: "How do I renew?", fil: "Paano ako magre-renew?" },
      answer: [{
        en: "Renew online, or contact the Red Cross team and they will guide you. You will get reminders before your membership ends. Email members@redcross.org.ph (or your chapter's email), or call 143, (+632) 8790-2300 local 184, or (+63) 917 844-6025.",
        fil: "Mag-renew online, o makipag-ugnayan sa team ng Red Cross at gagabayan ka nila. Makakatanggap ka ng paalala bago matapos ang membership mo. Mag-email sa members@redcross.org.ph (o sa email ng chapter mo), o tumawag sa 143, (+632) 8790-2300 local 184, o (+63) 917 844-6025.",
      }],
    },
    {
      id: "claim",
      keywords: { en: "claims reimbursement file filing documents deadline insurer", fil: "claims reimbursement magsumite dokumento deadline insurer" },
      question: { en: "How do I claim my benefits?", fil: "Paano ako magki-claim ng benepisyo?" },
      answer: [
        {
          en: "Tell the Red Cross about the accident or loss within 30 days, by text to (+63) 917 844-6025 or by email to maabclaims@redcross.org.ph (or your chapter's email).",
          fil: "Ipaalam sa Red Cross ang aksidente o pagkawala sa loob ng 30 araw, sa text sa (+63) 917 844-6025 o sa email sa maabclaims@redcross.org.ph (o sa email ng chapter mo).",
        },
        {
          en: "Send all required claim documents to the nearest Red Cross chapter within 60 days of the accident (outpatient), or of the day you left the hospital (if you were hospitalized).",
          fil: "Ipasa ang lahat ng kinakailangang dokumento sa pinakamalapit na chapter ng Red Cross sa loob ng 60 araw mula sa aksidente (outpatient), o mula sa araw ng paglabas mo sa ospital (kung na-confine ka).",
        },
        {
          en: "For questions about claims, email maabclaims@redcross.org.ph or call (+632) 8790-2300 local 184 or (+63) 917 844-6025.",
          fil: "Para sa mga tanong tungkol sa claims, mag-email sa maabclaims@redcross.org.ph o tumawag sa (+632) 8790-2300 local 184 o (+63) 917 844-6025.",
        },
      ],
      more: {
        landing: "#accident",
        member: "/member/library/guide#claims",
        label: { en: "See the steps and deadlines", fil: "Tingnan ang mga hakbang at deadline" },
      },
    },
    {
      id: "accident",
      keywords: { en: "emergency ambulance hotline hurt injured crash", fil: "emergency ambulansya hotline nasugatan sakuna" },
      question: { en: "What should I do if I have an accident?", fil: "Ano ang dapat kong gawin kapag may aksidente?" },
      answer: [{
        en: "Call 143 from any phone or landline. Tell the operator you are a Safe Card holder, give your Safe Card number, and describe the accident.",
        fil: "Tumawag sa 143 mula sa kahit anong telepono o landline. Sabihin sa operator na Safe Card holder ka, ibigay ang Safe Card number mo, at ilarawan ang aksidente.",
      }],
    },
    {
      id: "lost-card",
      keywords: { en: "lost missing stolen replace replacement certificate card", fil: "nawala nawalang nanakaw palit palitan certificate card" },
      question: { en: "What if I lose my card?", fil: "Paano kung mawala ang card ko?" },
      answer: [{
        en: "Your benefits continue, but a new card is not issued. To ask for a membership certificate, call or visit the chapter that registered you or the Red Cross national headquarters, call (+632) 8790-2300 local 184 or (+63) 917 844-6025, or email members@redcross.org.ph.",
        fil: "Tuloy ang mga benepisyo mo, pero hindi maglalabas ng bagong card. Para humingi ng membership certificate, tumawag o bumisita sa chapter na nag-register sa iyo o sa national headquarters ng Red Cross, tumawag sa (+632) 8790-2300 local 184 o (+63) 917 844-6025, o mag-email sa members@redcross.org.ph.",
      }],
    },
    {
      id: "more-info",
      keywords: { en: "contact email phone telephone website facebook help support", fil: "contact telepono email website facebook tulong" },
      question: { en: "Where can I get more information?", fil: "Saan ako makakakuha ng karagdagang impormasyon?" },
      answer: [{
        en: "Email members@redcross.org.ph, call 143, (+632) 8790-2300 local 184 or (+63) 917 844-6025, or visit www.redcross.org.ph. You can also contact the Philippine Red Cross Official Page or your chapter's Facebook page.",
        fil: "Mag-email sa members@redcross.org.ph, tumawag sa 143, (+632) 8790-2300 local 184 o (+63) 917 844-6025, o bisitahin ang www.redcross.org.ph. Maaari ka ring makipag-ugnayan sa Philippine Red Cross Official Page o sa Facebook page ng chapter mo.",
      }],
    },
  ] as readonly FaqItem[],
} as const;

// --------------------------------------------------------------------- Downloads
export const downloads = {
  eyebrow: { en: "Downloads", fil: "Mga download" },
  title: { en: "Take it with you.", fil: "Dalhin ito sa iyo." },
  intro: { en: "Share these with your family before you decide.", fil: "Ibahagi ito sa pamilya mo bago ka magpasya." },
  download: { en: "Download", fil: "I-download" },
  englishOnly: { en: "English", fil: "Ingles" },
  slides: { en: "slides", fil: "slides" },
  pages: { en: "pages", fil: "pahina" },
  items: {
    "program-overview": {
      description: {
        en: "The full Safe Card presentation: the Red Cross, the membership, the benefits and how to claim.",
        fil: "Ang buong presentasyon ng Safe Card: ang Red Cross, ang membership, ang mga benepisyo, at kung paano mag-claim.",
      },
      thumbnail: { src: "/images/education/thumb-program-overview.webp", width: 420, height: 237 },
    },
    faqs: {
      description: {
        en: "A two-page brochure with the most common questions.",
        fil: "Dalawang-pahinang brochure na may mga pinakamadalas na tanong.",
      },
      thumbnail: { src: "/images/education/thumb-faqs.webp", width: 420, height: 297 },
    },
    "member-guide": {
      description: {
        en: "Your benefits, rules, how to claim, the documents to bring, and the list of chapters.",
        fil: "Ang mga benepisyo mo, mga patakaran, paano mag-claim, mga dokumentong dadalhin, at ang listahan ng mga chapter.",
      },
      thumbnail: { src: "/images/education/thumb-member-guide.webp", width: 300, height: 424 },
    },
  },
} as const;

// -------------------------------------------------------------- Member library
export const library = {
  navCard: { en: "My card", fil: "Aking card" },
  navStatus: { en: "Status", fil: "Status" },
  navLibrary: { en: "Library", fil: "Aklatan" },
  navLabel: { en: "Member sections", fil: "Mga seksyon ng member" },
  eyebrow: { en: "Member library", fil: "Aklatan ng member" },
  title: { en: "Your Safe Card library", fil: "Ang aklatan ng iyong Safe Card" },
  intro: {
    en: "Read your documents here, or download them to keep.",
    fil: "Basahin dito ang iyong mga dokumento, o i-download para itago.",
  },
  read: { en: "Read online", fil: "Basahin online" },
  readFaq: { en: "Read the questions", fil: "Basahin ang mga tanong" },
  languageNotice: {
    en: "The Member Guide is available in English only.",
    fil: "Ingles lamang ang Member Guide. Hinihintay pa ang pag-apruba ng PRC sa bersyong Filipino.",
  },
  faqTitle: { en: "Frequently asked questions", fil: "Mga madalas itanong" },
  faqIntro: {
    en: "Quick answers about your membership, renewals, claims and what to do after an accident.",
    fil: "Mabilis na sagot tungkol sa membership mo, renewal, claims, at kung ano ang gagawin pagkatapos ng aksidente.",
  },
  backToLibrary: { en: "Back to the library", fil: "Bumalik sa aklatan" },
  signOut: { en: "Sign out", fil: "Mag-sign out" },
} as const;
