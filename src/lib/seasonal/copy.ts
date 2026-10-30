import type { Locale } from "@/lib/public-content";

type Pair = Record<Locale, string>;
const p = (en: string, fil: string): Pair => ({ en, fil });

/**
 * Every word the Christmas campaign adds, in one place, in both languages.
 * Amounts and benefit names are NOT repeated here: the landing gift band reads
 * them from lib/education/content so there is a single source of truth.
 */
export const seasonalCopy = {
  strip: p(
    "Give protection this Christmas. Apply by December 10 so it is ready for the holidays.",
    "Magregalo ng proteksyon ngayong Pasko. Mag-apply bago mag-Disyembre 10 para handa sa kapaskuhan.",
  ),
  stripLink: p("How gifting works", "Paano magregalo"),
  navGift: p("Gift", "Regalo"),
  footerTag: p("Merry Christmas from SafeCard", "Maligayang Pasko mula sa SafeCard"),
  footerTagApplyBy: p("Apply by December 10 for the holidays", "Mag-apply bago mag-Disyembre 10 para sa kapaskuhan"),

  badge: p("Regalo ng Proteksyon · Christmas gift", "Regalo ng Proteksyon · Handog ngayong Pasko"),
  heroTitle: p("The gift that protects the ones you love", "Ang regalong nagpoprotekta sa mahal mo sa buhay"),
  heroBody: p(
    "A year of accident protection for a parent, a child, or a friend. They apply and decide for themselves. You can pay for them.",
    "Isang taon ng proteksyon laban sa aksidente para sa magulang, anak, o kaibigan. Sila ang mag-a-apply at magpapasya. Ikaw ang maaaring magbayad.",
  ),
  giveCta: p("Give as a gift", "Iregalo ito"),
  howCta: p("How gifting works", "Paano magregalo"),
  trust: p(
    "Their choice. Their details. The Philippine Red Cross confirms the membership.",
    "Sila ang magpapasya. Sila ang magbibigay ng detalye. Ang Philippine Red Cross ang kukumpirma ng membership.",
  ),

  // Gift page
  pageTitle: p("Give a year of protection this Christmas", "Magregalo ng isang taon ng proteksyon ngayong Pasko"),
  pageLede: p(
    "SafeCard is a PHP 1,200 membership for one person. They apply and decide for themselves. You choose to pay for it.",
    "Ang SafeCard ay ₱1,200 na membership para sa isang tao. Sila ang mag-a-apply at magpapasya. Ikaw ang pipili kung babayaran mo ito.",
  ),
  stepsTitle: p("How gifting works", "Paano magregalo"),
  steps: [
    { title: p("Share a gift card", "Magpadala ng gift card"), text: p("Make a card with both your names and send it on Messenger or Viber. Nothing you type is saved.", "Gumawa ng card na may pangalan ninyong dalawa at ipadala sa Messenger o Viber. Walang sine-save sa itinype mo.") },
    { title: p("They decide and apply", "Sila ang magpapasya at mag-a-apply"), text: p("They can accept, ask a question, or say not now. Your gift does not decide for them.", "Maaari silang tumanggap, magtanong, o humindi muna. Hindi ang regalo mo ang magpapasya para sa kanila.") },
    { title: p("Pay and confirm", "Magbayad at kumpirmahin"), text: p("Pay by GCash or bank transfer. The Philippine Red Cross confirms the membership.", "Magbayad sa GCash o bank transfer. Ang Philippine Red Cross ang kukumpirma ng membership.") },
  ],
  applyByTitle: p("Apply by December 10", "Mag-apply bago mag-Disyembre 10"),
  applyByBody: p(
    "Payment review and Red Cross confirmation take a little time, so applying early helps the gift be ready for the holidays.",
    "Medyo may inaabot ang pagsusuri ng bayad at ang kumpirmasyon ng Red Cross, kaya mas mainam na mag-apply nang maaga para handa ang regalo sa kapaskuhan.",
  ),
  faqTitle: p("Questions about gifting", "Mga tanong tungkol sa pagreregalo"),
  faq: [
    { q: p("Can I transfer or share a membership?", "Maaari bang ilipat o ibahagi ang membership?"), a: p("A membership belongs to one person and cannot be transferred. To gift it, you pay for the person who applies.", "Para sa isang tao lamang ang membership at hindi ito maaaring ilipat. Para iregalo ito, babayaran mo ang taong mag-a-apply.") },
    { q: p("Who can receive one?", "Sino ang maaaring makatanggap?"), a: p("Anyone aged 3 to 85, including foreigners living in the Philippines.", "Sinumang may edad 3 hanggang 85, kasama ang mga dayuhang naninirahan sa Pilipinas.") },
    { q: p("Can I give one to several people?", "Maaari ba akong magregalo sa maraming tao?"), a: p("Yes. Make one card for each person. Each person applies on their own, and each membership is paid separately.", "Oo. Gumawa ng isang card para sa bawat tao. Bawat isa ay mag-a-apply nang hiwalay, at hiwalay ang bayad sa bawat membership.") },
    { q: p("Will I see their details?", "Makikita ko ba ang detalye nila?"), a: p("No. Paying for a gift does not give you access to their application or personal details.", "Hindi. Hindi ka bibigyan ng access sa application o personal na detalye nila dahil lang nagbayad ka.") },
    { q: p("How is it paid?", "Paano ang bayad?"), a: p("Payment details are shown in the application. You can pay from your own GCash or bank account and share the reference with them.", "Makikita ang detalye ng bayad sa application. Maaari kang magbayad mula sa sarili mong GCash o bank account at ibigay sa kanila ang reference.") },
  ],
  finalTitle: p("Ready to give?", "Handa ka na bang magregalo?"),
  finalBody: p("It takes about a minute to make a card.", "Halos isang minuto lang gumawa ng card."),

  // Gift band on the landing page
  bandTitle: p("A Christmas gift that looks after them all year", "Regalong Pamasko na nag-aalaga sa kanila buong taon"),
  bandBody: p(
    "Give someone you love a SafeCard membership. They stay in control, and you get the joy of giving.",
    "Iregalo ang SafeCard membership sa mahal mo sa buhay. Sila ang may kontrol, at sa iyo ang saya ng pagbibigay.",
  ),
  bandArt: p("A wrapped gift with a red ribbon", "Isang regalong may pulang laso"),

  // Card maker
  makerTitle: p("Create a gift card", "Gumawa ng gift card"),
  makerLede: p("Type two names, then share the card. It is made on your phone and nothing is saved.", "Maglagay ng dalawang pangalan, saka ipadala ang card. Ginagawa ito sa phone mo at walang sine-save."),
  fromLabel: p("Your name", "Pangalan mo"),
  toLabel: p("Their name", "Pangalan nila"),
  languageLabel: p("Card language", "Wika ng card"),
  share: p("Share card", "Ipadala ang card"),
  download: p("Download image", "I-download ang larawan"),
  copy: p("Copy message", "Kopyahin ang mensahe"),
  copied: p("Message copied", "Nakopya ang mensahe"),
  copyFailed: p("Could not copy. Select the text and copy it by hand.", "Hindi makopya. Piliin ang text at kopyahin nang mano-mano."),
  downloaded: p("Image saved", "Na-save ang larawan"),
  shared: p("Card shared", "Naipadala ang card"),
  privacy: p("Names stay on your phone. We do not store them.", "Nasa phone mo lang ang mga pangalan. Hindi namin sine-save ang mga ito."),
  previewLabel: p("Gift card preview", "Preview ng gift card"),
  messagePreview: p("Message that goes with the card", "Mensaheng kasama ng card"),
  cardFooter: p("Open the link to decide for yourself", "Buksan ang link para magpasya ka"),
  cardBrand: p("SafeCard · Philippine Red Cross", "SafeCard · Philippine Red Cross"),


  // Welcome shown to the person who opens a gift link
  welcomeTitle: p("Someone is thinking of you this Christmas", "May nag-iisip sa iyo ngayong Pasko"),
  welcomeBody: p(
    "A SafeCard membership can be yours for a year. Joining is your choice, and you can ask a question or say not now at any step.",
    "Maaaring maging iyo ang SafeCard membership sa loob ng isang taon. Ikaw ang magpapasya, at maaari kang magtanong o humindi muna sa anumang hakbang.",
  ),

  // Member card
  memberGreetingTitle: p("Merry Christmas!", "Maligayang Pasko!"),
  memberGreetingBody: p("Thank you for being part of SafeCard. Keep your card number handy and call 143 in an emergency.", "Salamat sa pagiging bahagi ng SafeCard. Itabi ang card number mo at tumawag sa 143 kapag may emergency."),
} as const;
