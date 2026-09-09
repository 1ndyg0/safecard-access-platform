/**
 * Version-controlled fallback storyboard content.
 *
 * This ships in the repository so the benefits page can render
 * immediately and correctly even when the governed content service is
 * slow or unreachable. It is marked `provisional`, and the UI says so:
 * an ambassador explaining benefits from this content should know it has
 * not been approved by PRC yet.
 *
 * Personas are invented. Amounts are illustrative and every scenario
 * carries a disclaimer, because the purpose of these cards is to help
 * someone understand how assistance works — not to tell them what they
 * will receive.
 */

import type { StoryboardContent } from './schema';

export const FALLBACK_VERSION = 'fallback-2026-09-09';

export const fallbackStoryboard: StoryboardContent = {
  version: FALLBACK_VERSION,
  provenance: 'provisional',
  approvedBy: null,
  approvedAt: null,
  cards: [
    {
      id: 'ambulance',
      icon: '🚑',
      title: { fil: 'Libreng tulong sa ambulansya', en: 'Free ambulance assistance' },
      summary: {
        fil: 'Ano ang gagawin kapag kailangan ng agarang transport.',
        en: 'What to do when someone needs emergency transport.',
      },
      scenario: {
        fil: {
          persona: 'Si Aling Rosa, 52, tindera sa palengke',
          situation:
            'Bigla na lang nanghina ang asawa ni Aling Rosa sa bahay at hindi siya makatayo. Walang sasakyan sa kanilang lugar at hindi nila alam kung saan tatawag.',
          action:
            'Tumawag agad sa Hotline 143. Sabihin ang eksaktong lokasyon, ang nangyari, at kung gising pa ang pasyente. Manatili sa linya hanggang may tagubilin.',
          mayProvide:
            'Maaaring tumulong ang PRC sa pag-dispatch ng ambulansya at magbigay ng gabay habang naghihintay, depende sa availability sa inyong lugar.',
          costExample:
            'Ang pribadong ambulansya sa ilang lugar ay maaaring umabot ng ilang libong piso. Layunin ng tulong na ito na mabawasan ang pasaning iyon.',
          disclaimer:
            'Halimbawa lamang ito. Nakadepende ang aktwal na tulong sa opisyal na patakaran ng PRC, sa eligibility, sa limitasyon, at sa availability sa oras ng pangangailangan.',
          hotlineGuidance: 'Para sa emergency at opisyal na tanong, tumawag sa Hotline 143.',
        },
        en: {
          persona: 'Aling Rosa, 52, a market vendor',
          situation:
            'Aling Rosa’s husband suddenly collapses at home and cannot stand. There is no vehicle nearby and they do not know who to call.',
          action:
            'Call Hotline 143 straight away. Give the exact location, what happened, and whether the patient is conscious. Stay on the line until you are given instructions.',
          mayProvide:
            'PRC may help dispatch an ambulance and give guidance while you wait, depending on availability in your area.',
          costExample:
            'A private ambulance can run to several thousand pesos in some areas. This assistance is meant to reduce that burden.',
          disclaimer:
            'This is an illustrative example only. Actual assistance depends on official PRC rules, eligibility, limits, and availability at the time of need.',
          hotlineGuidance: 'For emergencies and official questions, call Hotline 143.',
        },
      },
    },
    {
      id: 'blood',
      icon: '🩸',
      title: { fil: 'Tulong sa dugo', en: 'Blood assistance' },
      summary: {
        fil: 'Paano humingi ng tulong kapag may kailangang dugo.',
        en: 'How to ask for help when blood is needed.',
      },
      scenario: {
        fil: {
          persona: 'Si Mang Ador, 45, drayber ng tricycle',
          situation:
            'Kailangan ng anak ni Mang Ador ng dugo bago ang operasyon. Hindi niya alam kung paano magsisimula at wala siyang kakilalang donor.',
          action:
            'Ipaalam sa ospital ang pangangailangan, pagkatapos tumawag sa Hotline 143 upang malaman ang proseso at ang mga kailangang dokumento.',
          mayProvide:
            'Maaaring tumulong ang PRC sa paghahanap at pagproseso ng request para sa dugo, batay sa supply at sa mga opisyal na patakaran.',
          costExample:
            'Ang processing fee sa ilang pasilidad ay ilang daang piso bawat yunit. Layunin ng tulong na ito na gawing mas madali ang proseso.',
          disclaimer:
            'Halimbawa lamang ito. Nakadepende ang aktwal na tulong sa opisyal na patakaran ng PRC, sa eligibility, sa limitasyon, at sa supply sa oras ng pangangailangan.',
          hotlineGuidance: 'Para sa gabay sa proseso, tumawag sa Hotline 143.',
        },
        en: {
          persona: 'Mang Ador, 45, a tricycle driver',
          situation:
            'Mang Ador’s child needs blood before an operation. He does not know where to start and has no donor he can call on.',
          action:
            'Tell the hospital what is needed, then call Hotline 143 to learn the process and which documents are required.',
          mayProvide:
            'PRC may help locate and process a request for blood, subject to supply and official rules.',
          costExample:
            'Processing fees at some facilities run to a few hundred pesos per unit. This assistance is meant to make the process easier.',
          disclaimer:
            'This is an illustrative example only. Actual assistance depends on official PRC rules, eligibility, limits, and supply at the time of need.',
          hotlineGuidance: 'For guidance on the process, call Hotline 143.',
        },
      },
    },
    {
      id: 'hospital_allowance',
      icon: '🏥',
      title: { fil: 'Tulong sa ospital', en: 'Hospital allowance' },
      summary: {
        fil: 'Ano ang maaaring asahan kapag na-admit sa ospital.',
        en: 'What may be available when someone is admitted.',
      },
      scenario: {
        fil: {
          persona: 'Si Ate Lorna, 38, kasambahay',
          situation:
            'Na-admit si Ate Lorna ng tatlong araw dahil sa dengue. Nag-aalala siya sa gastos habang wala siyang kita.',
          action:
            'Itago ang lahat ng resibo at ang abstract ng ospital, pagkatapos tumawag sa Hotline 143 upang itanong ang proseso ng pag-file.',
          mayProvide:
            'Maaaring may tulong sa allowance para sa mga araw ng confinement, batay sa opisyal na patakaran at sa mga limitasyon ng PRC.',
          costExample:
            'Halimbawa, kung may allowance kada araw ng confinement, ang tatlong araw ay maaaring makatulong sa pagbabayad ng ilang gastusin.',
          disclaimer:
            'Halimbawa lamang ito. Nakadepende ang aktwal na halaga at ang pagiging kwalipikado sa opisyal na patakaran ng PRC, sa limitasyon, at sa availability.',
          hotlineGuidance: 'Para malaman ang tamang proseso, tumawag sa Hotline 143.',
        },
        en: {
          persona: 'Ate Lorna, 38, a household worker',
          situation:
            'Ate Lorna is admitted for three days with dengue. She is worried about the cost while she is not earning.',
          action:
            'Keep every receipt and the hospital abstract, then call Hotline 143 to ask about the filing process.',
          mayProvide:
            'An allowance may be available for days of confinement, subject to official PRC rules and limits.',
          costExample:
            'If a per-day allowance applies, three days could help cover part of the costs.',
          disclaimer:
            'This is an illustrative example only. The actual amount and whether it applies depend on official PRC rules, limits, and availability.',
          hotlineGuidance: 'To learn the correct process, call Hotline 143.',
        },
      },
    },
    {
      id: 'exclusions',
      icon: '⚠️',
      title: { fil: 'Mahahalagang limitasyon', en: 'Important exclusions and limitations' },
      summary: {
        fil: 'Ang hindi saklaw ay kasinghalaga ng saklaw.',
        en: 'What is not covered matters as much as what is.',
      },
      scenario: {
        fil: {
          persona: 'Si Kuya Ben, 30, construction worker',
          situation:
            'Akala ni Kuya Ben ay saklaw ng SafeCard ang lahat ng gastos sa ospital, kaya hindi na siya nag-ipon para sa ibang pangangailangan.',
          action:
            'Bago umasa sa anumang tulong, tanungin muna sa Hotline 143 kung ano ang saklaw, ano ang hindi, at ano ang mga kailangang dokumento.',
          mayProvide:
            'Ang SafeCard ay tulong, hindi kumpletong insurance. May mga kondisyon, limitasyon at panahon ng paghihintay na itinatakda ng PRC.',
          disclaimer:
            'Halimbawa lamang ito at hindi ito listahan ng opisyal na exclusions. Ang PRC lamang ang makakapagsabi kung ano ang saklaw at kung sino ang kwalipikado.',
          hotlineGuidance: 'Bago umasa sa saklaw, tumawag muna sa Hotline 143.',
        },
        en: {
          persona: 'Kuya Ben, 30, a construction worker',
          situation:
            'Kuya Ben assumed SafeCard covered every hospital cost, so he stopped setting money aside for anything else.',
          action:
            'Before relying on any assistance, call Hotline 143 and ask what is covered, what is not, and which documents are needed.',
          mayProvide:
            'SafeCard is assistance, not full insurance. Conditions, limits and waiting periods are set by PRC.',
          disclaimer:
            'This is an illustrative example and is not a list of official exclusions. Only PRC can say what is covered and who is eligible.',
          hotlineGuidance: 'Before relying on coverage, call Hotline 143 first.',
        },
      },
    },
  ],
};
