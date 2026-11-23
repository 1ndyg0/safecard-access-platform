"use client";

import { useLocale } from "@/components/LocaleProvider";
import { AmbulanceIcon, BadgeCheckIcon } from "@/components/icons";
import styles from "./BenefitValueScenarios.module.css";

/** Arithmetic illustrations only; combined entitlements still need insurer confirmation. */
export function BenefitValueScenarios() {
  const { locale } = useLocale();
  const fil = locale === "fil";
  const medical = 10_000 * 2;
  const hospital = 200 * 60;
  const principal = 300_000;
  const peso = (amount: number) => `₱${amount.toLocaleString("en-PH")}`;
  const scenarios = [
    {
      title: fil ? "Kung nakaligtas ka na may kwalipikadong kapansanan" : "If you survive with a qualifying disability",
      label: fil ? "Suporta para sa iyo" : "Support for you",
      fatal: false,
    },
    {
      title: fil ? "Kung nagdulot ng pagkamatay ang aksidente" : "If an accident results in death",
      label: fil ? "Suporta para sa pamilya mo" : "Support for your family",
      fatal: true,
    },
  ];
  return (
    <section className={styles.section} aria-labelledby="benefit-values-title" id="benefit-values">
      <div className="edu-heading">
        <p className="eyebrow">{fil ? "Paano maaaring magsama-sama ang mga benepisyo" : "How the benefits could add up"}</p>
        <h2 id="benefit-values-title">{fil ? "Isang membership. Tulong sa oras ng pangangailangan." : "One membership. Support when it matters."}</h2>
        <p className="edu-intro">{fil ? "Dalawang kwalipikadong aksidente at kabuuang 60 kwalipikadong araw sa ospital: narito ang mga halimbawang halaga." : "Here is what two eligible accidents and 60 eligible hospital days in total could look like."}</p>
      </div>
      <p className={styles.notice}>{fil ? "Halimbawa lamang. Kailangan pa ng kumpirmasyon ng PRC / PGAI tungkol sa pagsasama ng mga benepisyo at taunang limitasyon." : "Draft illustration. Combined payouts and annual limits still require PRC / PGAI confirmation."}</p>
      <div className={styles.grid}>
        {scenarios.map(({ title, label, fatal }) => (
          <article className={styles.card} key={label}>
            <header className={styles.head}><BadgeCheckIcon size={24} /><div><p>{label}</p><h3>{title}</h3></div></header>
            <div className={styles.total}><strong>{peso(medical + hospital + principal + (fatal ? 5_000 : 0))}</strong><p>{fil ? "Halimbawang subtotal ng insurance" : "Illustrative insurance subtotal"}</p></div>
            <dl className={styles.breakdown}>
              <div><dt>{fil ? "Reimbursement sa pagpapagamot" : "Medical reimbursement"}<small>{fil ? "₱10,000 × 2 kwalipikadong aksidente" : "₱10,000 × 2 eligible accidents"}</small></dt><dd>{peso(medical)}</dd></div>
              <div><dt>{fil ? "Arawang allowance sa ospital" : "Hospital allowance"}<small>{fil ? "₱200 × kabuuang 60 kwalipikadong araw" : "₱200 × 60 eligible days in total"}{fatal && (fil ? ", bago mamatay" : ", before death")}</small></dt><dd>{peso(hospital)}</dd></div>
              <div><dt>{fatal ? (fil ? "Benepisyo sa pagkamatay dahil sa aksidente" : "Accidental death benefit") : (fil ? "Kwalipikadong kapansanan o pagkawala ng biyas" : "Qualifying disability or limb loss")}{!fatal && <small>{fil ? "Ipinapalagay ang 100% ng nakatakdang benepisyo" : "Assumes a 100% scheduled benefit"}</small>}</dt><dd>{peso(principal)}</dd></div>
              {fatal && <div><dt>{fil ? "Tulong sa libing" : "Burial assistance"}</dt><dd>{peso(5_000)}</dd></div>}
            </dl>
          </article>
        ))}
      </div>
      <div className={styles.services}>
        <header><AmbulanceIcon size={24} /><h3>{fil ? "May dagdag pang agarang tulong mula sa Red Cross" : "Plus help on the spot from the Red Cross"}</h3></header>
        <ul><li><strong>{fil ? "1 serbisyo ng ambulansya" : "1 ambulance service"}</strong><span>{fil ? "Papunta sa pinakamalapit na ospital pagkatapos ng aksidente." : "To the nearest hospital after an accident."}</span></li><li><strong>{fil ? "1 unit ng dugo" : "1 unit of blood"}</strong><span>{fil ? "Para sa aksidente. Hindi kasama ang apheresis products." : "For accident-related needs. Excludes apheresis products."}</span></li></ul>
        <p>{fil ? "Hindi kasama ang mga serbisyong ito sa mga halagang nasa itaas. Nakadepende sa availability at mga kondisyon ng programa." : "Service benefits are separate from the peso totals. Availability and program conditions apply."}</p>
      </div>
      <p className={styles.disclaimer}>{fil ? "Magkahiwalay na halimbawa ang mga ito; huwag pagsamahin ang mga halaga. Hindi ipinapalagay na maaaring idagdag ang benepisyo sa pagkamatay sa buong benepisyo sa kapansanan. Ang aktuwal na bayad ay nakadepende sa kwalipikadong gastos, limitasyon ng polisiya, mga dokumento at pag-apruba ng insurer." : "These are separate examples, not amounts to add together. Death and disability payments are not assumed to stack. Actual claims depend on eligible expenses, policy limits, supporting documents and insurer approval."}</p>
      <details className={styles.assumptions}><summary>{fil ? "Tingnan ang mga palagay sa mga halimbawa" : "See the assumptions behind these examples"}</summary><ul>
        <li>{fil ? "Dalawang magkahiwalay na kwalipikadong aksidente sa panahon ng membership, na may hindi bababa sa ₱10,000 na kwalipikadong gastos bawat aksidente." : "Two separate eligible accidents during the membership period, with at least ₱10,000 of eligible medical expenses per accident."}</li>
        <li>{fil ? "Kabuuang 60 kwalipikadong araw sa ospital sa dalawang aksidente. Hindi ipinapalagay na umuulit ang 60-araw na limitasyon bawat aksidente." : "60 eligible hospital days across both accidents in total. This does not assume that the 60-day limit resets per accident."}</li>
        <li>{fil ? "Sa halimbawang nakaligtas, ipinapalagay ang pinsalang kwalipikado sa 100% ng ₱300,000 na benepisyo. Mas mababa ang maaaring bayad sa ibang pinsala." : "The survival example assumes an injury qualifying for 100% of the scheduled ₱300,000 benefit. Other injuries can pay less."}</li>
        <li>{fil ? "Sa halimbawang namatay, pinapalitan ng death benefit ang disability benefit. Ipinapalagay na may kwalipikadong gastos at pananatili sa ospital bago mamatay." : "The fatal example replaces the disability benefit with the death benefit and assumes eligible medical expenses and confinement before death."}</li>
        <li>{fil ? "Kailangang kumpirmahin ng PRC / PGAI ang pagsasama ng mga benepisyo at taunang limitasyon bago ilathala ang mga subtotal bilang kumpirmadong benepisyo." : "PRC / PGAI must confirm combined benefits and annual limits before these subtotals are published as confirmed entitlements."}</li>
      </ul></details>
    </section>
  );
}
