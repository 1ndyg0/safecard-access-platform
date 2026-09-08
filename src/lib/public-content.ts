export type Locale = "fil" | "en";

export const benefits = [
  { amount: "PRC-approved limit required", fil: "Tulong sa ambulansya", en: "Ambulance assistance", detailFil: "Para sa kwalipikadong emergency, ayon sa opisyal na tuntunin ng PRC.", detailEn: "For qualifying emergencies, subject to official PRC terms." },
  { amount: "PRC-approved limit required", fil: "Tulong sa dugo", en: "Blood assistance", detailFil: "Ang availability, limitasyon, at proseso ay kinukumpirma ng PRC.", detailEn: "Availability, limits, and process are confirmed by PRC." },
  { amount: "PRC-approved limit required", fil: "Tulong sa aksidente", en: "Accident assistance", detailFil: "Hindi lahat ng insidente ay sakop; may exclusions at dokumentong kailangan.", detailEn: "Not every incident is covered; exclusions and documents apply." },
  { amount: "PRC decides eligibility", fil: "Proteksiyong may malinaw na hangganan", en: "Protection with clear boundaries", detailFil: "Ang PRC lamang ang nagkukumpirma ng eligibility, activation, at claim.", detailEn: "Only PRC confirms eligibility, activation, and claims." },
] as const;

export const copy = {
  fil: {
    navBenefits: "Mga benepisyo", navProcess: "Proseso", memberLogin: "Member login", ambassadorLogin: "Ambassador", adminLogin: "Admin",
    badge: "Controlled pilot · content for validation", heroTitle: "Unawain muna. Ikaw ang magpasya.",
    heroBody: "Isang consent-first na paraan para matutunan ang Safe Card, pumili nang pribado, at isumite ang application kapag handa ka.",
    primaryCta: "Simulan ang pribadong walkthrough", secondaryCta: "Basahin ang mga benepisyo",
    voluntary: "Kusang-loob ang paglahok. Maaari kang magtanong, huminto, o tumanggi nang walang kapalit.",
    benefitsEyebrow: "Alamin bago pumili", benefitsTitle: "Maliwanag na impormasyon, walang pangako ng resulta.",
    processTitle: "Isang proseso na inuuna ang iyong kontrol", footerNote: "School-project pilot. Hindi ito opisyal na PRC enrollment portal.",
  },
  en: {
    navBenefits: "Benefits", navProcess: "How it works", memberLogin: "Member login", ambassadorLogin: "Ambassador", adminLogin: "Admin",
    badge: "Controlled pilot · content for validation", heroTitle: "Understand first. Decide for yourself.",
    heroBody: "A consent-first way to learn about Safe Card, decide privately, and submit an application only when you are ready.",
    primaryCta: "Start the private walkthrough", secondaryCta: "Read the benefits",
    voluntary: "Participation is voluntary. You may ask, pause, or decline without consequence.",
    benefitsEyebrow: "Know before you choose", benefitsTitle: "Clear information without promises of an outcome.",
    processTitle: "A process that keeps you in control", footerNote: "School-project pilot. This is not an official PRC enrollment portal.",
  },
} as const;

export const CURRENT_WORKING_FEE = "₱1,200 / year";
export const CURRENT_WORKING_ELIGIBILITY = "Ages 3–85";
