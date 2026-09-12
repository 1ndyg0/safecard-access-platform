export type StoryboardLocale = 'fil' | 'en';

export type BenefitStoryboard = {
  id: string;
  icon: string;
  title: Record<StoryboardLocale, string>;
  summary: Record<StoryboardLocale, string>;
  scenario: Record<StoryboardLocale, {
    persona: string;
    situation: string;
    action: string;
    mayProvide: string;
    cost: string;
    disclaimer: string;
  }>;
};

/**
 * Version-controlled synthetic fallback content. Production copy must be
 * sourced from approved `content_versions` rows before live collection.
 */
export const benefitStoryboards: BenefitStoryboard[] = [
  {
    id: 'ambulance', icon: '🚑',
    title: { fil: 'Libreng Ambulansya', en: 'Ambulance assistance' },
    summary: { fil: 'Tumawag sa Hotline 143 para sa emergency guidance.', en: 'Call Hotline 143 for emergency guidance.' },
    scenario: {
      fil: {
        persona: 'Si Maria, 38, isang kasambahay',
        situation: 'Nadapa si Maria habang pauwi at kailangan niya ng agarang tulong.',
        action: 'Tumawag sa 143, ibigay ang lokasyon, at sundin ang instructions ng PRC. Kung ligtas, humingi rin ng tulong sa taong malapit.',
        mayProvide: 'Maaaring tumulong ang PRC sa emergency response ayon sa availability, eligibility, at opisyal na tuntunin.',
        cost: 'Walang ipinapangakong halaga o response time sa halimbawang ito. Ang anumang personal na gastos ay dapat linawin sa PRC.',
        disclaimer: 'Halimbawa lamang ito. Hindi nito ginagarantiya ang eligibility, response time, assistance amount, o claim outcome.',
      },
      en: {
        persona: 'Maria, 38, a household worker',
        situation: 'Maria falls on her way home and needs urgent help.',
        action: 'Call 143, share the location, and follow PRC instructions. If it is safe, also ask someone nearby for help.',
        mayProvide: 'PRC may assist with emergency response subject to availability, eligibility, and official rules.',
        cost: 'This example promises no amount or response time. Ask PRC about any personal costs.',
        disclaimer: 'Illustrative only. It does not guarantee eligibility, response time, assistance amount, or claim outcome.',
      },
    },
  },
  {
    id: 'blood', icon: '🩸',
    title: { fil: 'Libreng Dugo', en: 'Blood assistance' },
    summary: { fil: 'May requirements at availability na kinukumpirma ng PRC.', en: 'Requirements and availability are confirmed by PRC.' },
    scenario: {
      fil: {
        persona: 'Si Joel, 27, isang delivery rider',
        situation: 'May kamag-anak si Joel na nangangailangan ng blood support sa ospital.',
        action: 'Makipag-ugnayan sa PRC blood service o Hotline 143 at itanong ang requirements, blood type availability, at proseso.',
        mayProvide: 'Maaaring magbigay ng blood-service assistance ayon sa supply, eligibility, documentation, at opisyal na proseso.',
        cost: 'Hindi nagbibigay ang halimbawang ito ng eksaktong halaga o guarantee ng blood availability.',
        disclaimer: 'Halimbawa lamang ito. Hindi nito ginagarantiya ang eligibility, availability, amount, o claim outcome.',
      },
      en: {
        persona: 'Joel, 27, a delivery rider',
        situation: 'A family member of Joel needs blood support at a hospital.',
        action: 'Contact PRC blood services or Hotline 143 to ask about requirements, availability, and next steps.',
        mayProvide: 'PRC may provide blood-service assistance subject to supply, eligibility, documentation, and official process.',
        cost: 'This example does not state an exact amount or guarantee blood availability.',
        disclaimer: 'Illustrative only. It does not guarantee eligibility, availability, amount, or claim outcome.',
      },
    },
  },
  {
    id: 'hospital', icon: '🏥',
    title: { fil: 'Hospital allowance', en: 'Hospital allowance' },
    summary: { fil: 'Ang eligibility at limit ay ayon sa opisyal na PRC rules.', en: 'Eligibility and limits follow official PRC rules.' },
    scenario: {
      fil: {
        persona: 'Si Liza, 45, isang market vendor',
        situation: 'Na-admit si Liza at gusto niyang malaman kung may maaaring assistance para sa kanyang sitwasyon.',
        action: 'Itanong sa PRC ang eligibility, documents, deadlines, at kung paano isumite ang claim. Huwag umasa sa platform para magdesisyon ng claim.',
        mayProvide: 'Maaaring may assistance kung kwalipikado ayon sa PRC terms; PRC lamang ang magpapasya.',
        cost: 'Walang ipinapangakong allowance amount sa halimbawang ito.',
        disclaimer: 'Halimbawa lamang ito. Hindi nito ginagarantiya ang eligibility, approval, benefit amount, o claim outcome.',
      },
      en: {
        persona: 'Liza, 45, a market vendor',
        situation: 'Liza is admitted and wants to know whether her situation may qualify for assistance.',
        action: 'Ask PRC about eligibility, documents, deadlines, and claim submission. The platform never decides a claim.',
        mayProvide: 'Assistance may be available when the situation qualifies under PRC terms; PRC decides.',
        cost: 'This example promises no allowance amount.',
        disclaimer: 'Illustrative only. It does not guarantee eligibility, approval, benefit amount, or claim outcome.',
      },
    },
  },
  {
    id: 'exclusions', icon: '⚠️',
    title: { fil: 'Hindi kasama at mga limitasyon', en: 'Exclusions and limits' },
    summary: { fil: 'Basahin ang buong approved terms bago magpasya.', en: 'Read the full approved terms before deciding.' },
    scenario: {
      fil: {
        persona: 'Si Ana, isang prospective member',
        situation: 'May tanong si Ana kung sakop ang isang kondisyon o event na hindi malinaw sa maikling guide.',
        action: 'Huwag manghula. Basahin ang published PRC terms o tumawag sa 143 bago magbayad o magsumite.',
        mayProvide: 'Ang PRC lamang ang makakapagkumpirma ng exclusions, eligibility, at claim outcome.',
        cost: 'Hindi naglilista ang provisional example na ito ng unsupported amount o promise.',
        disclaimer: 'Halimbawa lamang ito. Hindi nito pinapalitan ang approved PRC terms o claims decision.',
      },
      en: {
        persona: 'Ana, a prospective member',
        situation: 'Ana is unsure whether a condition or event is covered by a short guide.',
        action: 'Do not guess. Read the published PRC terms or call 143 before paying or submitting.',
        mayProvide: 'Only PRC can confirm exclusions, eligibility, and claim outcomes.',
        cost: 'This provisional example does not list an unsupported amount or promise.',
        disclaimer: 'Illustrative only. It does not replace approved PRC terms or a claims decision.',
      },
    },
  },
];
