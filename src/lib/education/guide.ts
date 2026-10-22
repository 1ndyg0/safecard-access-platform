/**
 * PRC Safe Card Member Guide 2026, as reading text.
 *
 * Sections 01 to 11 follow the numbering and wording of the official PDF
 * (`content/documents/prc-safe-card-member-guide-2026.pdf`). Each section
 * carries the PDF page it starts on so a reader can open the original.
 * The PDF is the official copy. Where this text and the PDF differ, the PDF
 * is right and this file is the bug.
 *
 * Deliberate differences from the PDF, each recorded in
 * docs/program-information.md:
 *   - The Safe Card / Claims telephone number is printed as
 *     (+63 2) 8790-2300 local 184. The PDF page footers print "790-2300",
 *     while its own trunkline and the FAQs print "8790-2300".
 *   - The claims email is printed as maabclaims@redcross.org.ph, the form
 *     used in the FAQs and in the guide's claims contacts. The last page of
 *     the PDF prints a variant with an extra "b" that is not an address.
 *   - The About the Philippine Red Cross pages (3 and 4) and the chapter
 *     directory (25 to 59) are left in the PDF.
 */

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: readonly string[] }
  | { type: "callout"; tone: "info" | "warn"; text: string }
  | { type: "table"; head: readonly string[]; rows: readonly (readonly string[])[]; firstColumnHeader?: boolean }
  | { type: "steps"; items: readonly { title: string; text: string }[] }
  | { type: "claimDocs"; rows: readonly { claim: string; items: readonly string[]; chapter: string }[] }
  | { type: "pdfLink"; label: string; page: number };

export interface GuideSection {
  id: string;
  /** "01" to "11" as printed in the PDF. Empty for the unnumbered notice and directory. */
  number: string;
  title: string;
  /** PDF page this section starts on. */
  page: number;
  blocks: readonly GuideBlock[];
}

const CHAPTER_PROVIDES = "Provided by the chapter: Claim Form; Listing & Report No. of Declaration.";

export const GUIDE_TITLE = "PRC Safe Card Member Guide 2026";

export const GUIDE_INTRO =
  "This is the reading version of your Member Guide. The PDF is the official copy, and every section shows the page to open it on.";

export const guideSections: readonly GuideSection[] = [
  {
    id: "notice",
    number: "",
    title: "Please read before using your Safe Card",
    page: 2,
    blocks: [
      { type: "p", text: "Membership is personal and non-transferable. Insurance coverage is underwritten by Prudential Guarantee and Assurance, Inc. (PGAI) and is subject to the applicable group/master policy, approved schedule of benefits, eligibility rules, exclusions, conditions, and claims requirements." },
      { type: "p", text: "Ambulance and blood assistance are humanitarian/service benefits provided by the Philippine Red Cross, subject to operational availability, selected service areas, distance from the incident, resources, and applicable protocols." },
      { type: "callout", tone: "warn", text: "The Philippine Red Cross is NOT an insurer. Philippine Red Cross administers the Safe Card membership program. Insurance coverage and claim payments are the sole responsibility of PGAI under the applicable policy." },
    ],
  },
  {
    id: "meaning",
    number: "01",
    title: "What your Safe Card means",
    page: 5,
    blocks: [
      { type: "p", text: "Your Safe Card is a Philippine Red Cross membership supported by an annual contribution. The membership program also provides access to specified accident assistance benefits underwritten by Prudential Guarantee and Assurance, Inc. (PGAI) under the applicable group/master insurance arrangement." },
      { type: "h3", text: "What is the membership program?" },
      { type: "ul", items: [
        "A form of contribution to the Philippine Red Cross to sustain PRC's effort in providing emergency and medical support to the people in times of disasters and emergencies.",
        "Membership provides Accident Assistance Benefits for one (1) year to every individual donor, ages 3 to 85 years old.",
      ] },
      { type: "h3", text: "Benefits of being a member" },
      { type: "ul", items: [
        "You become part of the premier humanitarian organization that alleviates human suffering and restores human dignity.",
        "You can have access to all services of the Red Cross.",
        "You create a sense of self-worth by giving.",
        "You are protected through Personal Accident Assistance Benefits.",
      ] },
      { type: "h3", text: "Membership: not a promise of unlimited services" },
      { type: "p", text: "Membership gives you access to the Philippine Red Cross humanitarian network and the benefits expressly stated for the program. It does not mean that every Philippine Red Cross service, ambulance unit, blood product, facility, responder, or other resource is available at every location or at all times." },
      { type: "h3", text: "What you receive" },
      { type: "table", head: ["Benefit", "Description"], firstColumnHeader: true, rows: [
        ["One-Year Philippine Red Cross Membership", "1 year from 12:00 noon of date declared in the policy"],
        ["Membership Accidental Assistance Benefits (MAAB)", "Underwritten by PGAI, for eligible members, subject to the applicable insurance terms."],
        ["Emergency Ambulance Assistance (due to accident)", "A Philippine Red Cross humanitarian service benefit, subject to availability and service conditions."],
        ["One Unit of Blood Bag (due to accident)", "A Philippine Red Cross humanitarian service benefit, subject to availability and service conditions."],
        ["Access to Philippine Red Cross Humanitarian Services", "In accordance with Philippine Red Cross policies, operational capacity, and applicable rules."],
      ] },
      { type: "h3", text: "What you should know, and what not to assume" },
      { type: "p", text: "To serve you better and ensure full transparency, we want you to understand exactly how your Safe Card works. This is not fine print: this is your guide to maximizing your membership." },
      { type: "steps", items: [
        { title: "On ambulance dispatch", text: "The Safe Card does not guarantee immediate ambulance dispatch, a fixed response time, or ambulance availability in your location. While we strive to reach you as fast as possible, traffic, weather, simultaneous emergencies, and other factors can affect our response time." },
        { title: "On blood availability", text: "The Safe Card does not guarantee the availability, supply, or provision of blood, any particular blood type or blood component, hospital acceptance, or delivery at any specific time or location. While the Philippine Red Cross prioritizes its members, the provision of blood and blood components remains subject to actual availability, donations, inventory levels, medical requirements, and other operational considerations in the relevant area." },
        { title: "On insurance payouts", text: "Insurance benefits are not automatically payable merely because an incident occurred. Eligibility, coverage, documentation, and policy terms must be satisfied. The insurance benefit is a separate financial protection underwritten by PGAI and is subject to their claims process." },
        { title: "On Philippine Red Cross and PGAI roles", text: "Philippine Red Cross membership and the insurance benefit are distinct. The Philippine Red Cross administers and facilitates the membership program but is not the insurer. The insurer, PGAI, makes insurance coverage and claim-payment determinations under the applicable policy." },
      ] },
    ],
  },
  {
    id: "terms",
    number: "02",
    title: "Membership terms",
    page: 7,
    blocks: [
      { type: "table", head: ["Item", "Safe Card term"], firstColumnHeader: true, rows: [
        ["Annual contribution", "₱1,200 per individual member."],
        ["Eligibility", "Individual donors aged 3 through 85 years old, subject to the program and applicable policy eligibility rules."],
        ["Validity", "One (1) year from the declared date/registration reflected in the Philippine Red Cross membership record or certificate."],
        ["Renewal", "Renewable annually, subject to payment, eligibility, and the terms applicable at renewal."],
        ["Transferability", "NON-TRANSFERABLE. The Safe Card and its membership/benefits belong only to the registered member and may not be sold, assigned, lent, transferred to, or substituted for another person."],
        ["Nature of contribution", "The membership contribution supports Philippine Red Cross humanitarian operations and services. The accident assistance component is underwritten by PGAI and subject to the applicable insurance arrangement."],
      ] },
      { type: "h3", text: "Important reminder: keep your member record accurate" },
      { type: "ul", items: [
        "Use your correct legal name, date of birth, and contact details when registering.",
        "Safeguard your Safe Card/Membership ID reference and do not allow another person to use it.",
        "Report errors in your membership record promptly to Philippine Red Cross through official channels.",
        "Renew your membership before expiry if you want uninterrupted eligibility for a subsequent membership year; renewal is not automatic unless expressly provided by Philippine Red Cross.",
      ] },
      { type: "p", text: "The Philippine Red Cross Act (RA 10072) provides that membership is open to the population in the Philippines and that an annual fund contribution entitles the contributor to membership for one year. This Guide applies the current Safe Card program terms to that membership framework." },
    ],
  },
  {
    id: "benefits",
    number: "03",
    title: "Accident assistance benefits",
    page: 8,
    blocks: [
      { type: "p", text: "Underwritten by Prudential Guarantee and Assurance, Inc. (PGAI). The following benefit limits are those currently published by Philippine Red Cross for the Safe Card/MAAB program. Actual payment remains subject to the applicable master policy issued by PGAI, including its certificate, definitions, exclusions, waiting periods, and claim requirements." },
      { type: "table", head: ["Benefit", "Current published limit", "Key condition"], firstColumnHeader: true, rows: [
        ["Accidental Death, Disablement & Dismemberment", "₱300,000", "Subject to the PGAI policy definitions and benefit schedule, and with required documents."],
        ["Unprovoked Murder & Assault", "₱300,000", "Subject to PGAI policy definitions, exclusions, and with required documents."],
        ["Accidental Medical Reimbursement", "₱10,000", "Covered accidental medical expenses, subject to PGAI policy terms and with required documents."],
        ["Burial Assistance — Accident", "₱5,000", "Payable only where the applicable accident benefit conditions are met under the PGAI policy and with required documents."],
        ["Hospital Daily Allowance", "₱200/day, up to 60 days", "Subject to the PGAI policy's covered confinement, illness/accident, waiting-period provisions, must have been confined at least 24 hrs before this benefit can be covered and with required documents."],
      ] },
      { type: "h3", text: "MAAB claim processing matrix" },
      { type: "table", head: ["Type of claim", "Accident", "Murder & Assault", "Sickness"], firstColumnHeader: true, rows: [
        ["Accidental Death", "✓", "✓", "—"],
        ["Accidental Medical Reimbursement", "✓", "—", "—"],
        ["Accidental Burial Assistance", "✓", "—", "—"],
        ["Hospital Daily Allowance", "✓", "✓", "—"],
      ] },
      { type: "h3", text: "Additional benefits" },
      { type: "ul", items: [
        "Animal and insect bites are covered under the Accident Assistance Benefit only when sustained as a result of an accident.",
        "Pre-existing conditions will be waived after 6 months from the date of effectivity of coverage, and 1 month for Natural Illnesses.",
      ] },
      { type: "h3", text: "Extension of coverage" },
      { type: "table", head: ["Coverage", "Description"], firstColumnHeader: true, rows: [
        ["Acts of Nature", "This policy extends to cover bodily injuries or death occasioned by or happening through Acts of God (i.e., flood, typhoon, hurricane, earthquake, volcanic eruption, or tidal wave)."],
        ["Travelling in Public and Private Conveyance", "By land, air, or sea as a fare-paying passenger and not as an operator or crew. (Volunteers of Red Cross are covered even if not fare-paying passengers if the reason for flying is for relief operations.)"],
        ["Riding", "As an operator or passenger of any two-wheeled motor vehicle with or without sidecar, except in any form of racing."],
        ["Dengue Cases", "Covered regardless of whether it is an OUTBREAK. Covers Medical Reimbursement and Daily Hospital Income Benefit only. Not covered within 30 days of membership."],
      ] },
      { type: "callout", tone: "info", text: "Waiting periods and pre-existing conditions: New members may be subject to waiting periods before certain hospital daily allowance benefits become available. A thirty (30)-day waiting period may apply to claims from natural illness and dengue, while a six (6)-month waiting period may apply to claims relating to specified pre-existing conditions. The specific waiting periods, exclusions, and coverage shall be governed by the applicable PGAI policy and the terms in effect on the member's membership date. Members are advised to refer to their current Membership ID and applicable policy documents, or confirm their coverage with the Philippine Red Cross or PGAI, as applicable." },
    ],
  },
  {
    id: "ambulance-blood",
    number: "04",
    title: "Ambulance and blood assistance",
    page: 11,
    blocks: [
      { type: "p", text: "These are valuable Philippine Red Cross humanitarian service benefits. They are service-availability benefits and are not unconditional guarantees of deployment or supply. These services are distinct from insurance benefits under the Safe Card and are not insurance benefits and are not underwritten by PGAI." },
      { type: "h3", text: "Free emergency ambulance service" },
      { type: "p", text: "In case of emergency, the member needs to call 143. Philippine Red Cross will then assess the request based on the information provided and, subject to availability of an appropriate ambulance, personnel, equipment, and other operational resources, as well as the location and prevailing circumstances, will coordinate and provide an appropriate response." },
      { type: "table", head: ["Service is subject to", "What this means for the member"], firstColumnHeader: true, rows: [
        ["Availability of a Philippine Red Cross ambulance", "A unit may be unavailable because it is deployed, under maintenance, responding to another incident, or otherwise not operational."],
        ["Selected service areas / area of responsibility", "Coverage depends on where the incident occurs and whether the Philippine Red Cross has an operational ambulance/resource serving that area."],
        ["Distance from the scene", "Dispatch and feasibility depend on the ambulance's location and distance from the scene, including travel conditions."],
        ["Road, traffic, and weather conditions", "Response and transport may be affected by traffic, road access, weather, security conditions, disasters, and other operational constraints."],
        ["Medical/operational priority", "Philippine Red Cross may prioritize calls based on emergency severity, patient condition, and operational protocols."],
        ["Receiving facility / transport decision", "Destination and transport decisions are subject to medical assessment, patient condition, operational protocols, and facility acceptance."],
      ] },
      { type: "h3", text: "One unit of whole blood" },
      { type: "p", text: "The Safe Card may provide one unit of blood bag subject to Philippine Red Cross Blood Services procedures. Availability is expressly dependent on blood inventory, compatible blood type/component availability, selected Philippine Red Cross blood facility/service area, hospital requirements, processing requirements, and logistics/distance from the requesting location. It is not a guarantee that a compatible unit will be immediately available." },
      { type: "callout", tone: "warn", text: "Important note: “Free” means that the Safe Card program may cover the stated benefit under its applicable terms. It does not mean unlimited ambulance services, unlimited transport, unlimited blood products, or that Philippine Red Cross must provide a unit/resource when none is operationally or medically available." },
    ],
  },
  {
    id: "responsibilities",
    number: "05",
    title: "Who is responsible for what",
    page: 13,
    blocks: [
      { type: "table", head: ["Philippine Red Cross", "Insurer: PGAI"], rows: [
        ["Administers the Safe Card membership program and maintains membership records.", "Provides the insurance/accident assistance coverage under the applicable master policy and certificate."],
        ["Facilitates member communications and receives/forwards claim submissions through designated Philippine Red Cross channels.", "Determines whether a claim is covered, payable, excluded, limited, or requires additional documentation, based on the policy."],
        ["Operates or coordinates Philippine Red Cross emergency services, including ambulance and blood services, subject to actual operational capacity and applicable procedures.", "Processes and settles valid insurance claims in accordance with the Insurance Code, regulations, and the applicable policy."],
        ["Does NOT guarantee that an ambulance, blood unit, responder, facility, or other resource is available at every location or at every time.", "Is NOT responsible for Philippine Red Cross operational dispatch decisions, ambulance fleet availability, blood inventory, or other Philippine Red Cross service-capacity matters unless expressly assumed in a written agreement."],
        ["Uses member information for legitimate membership, service, claims, compliance, and related program purposes, subject to applicable privacy requirements.", "Processes information necessary for underwriting, policy administration, claims investigation, and settlement, subject to applicable privacy and insurance requirements."],
      ] },
      { type: "h3", text: "Member undertakings" },
      { type: "ul", items: [
        "The member confirms that information submitted to the Philippine Red Cross is accurate and complete.",
        "The member will use the Safe Card only for the registered member.",
        "The member shall promptly notify the Philippine Red Cross of any accident or loss within thirty (30) days from the date of the accident or the date of discharge, as applicable, and shall submit truthful, complete, and required supporting documents.",
        "The member understands that submission of a claim is not an admission of coverage and that PGAI retains the authority to determine the claim under the policy.",
        "The member understands that emergency services are subject to actual availability, service area, distance, operational, and medical constraints.",
      ] },
    ],
  },
  {
    id: "claims",
    number: "06",
    title: "How to file an accident claim",
    page: 14,
    blocks: [
      { type: "p", text: "Safe Card procedure requires timely notification and submission of supporting documents. Philippine Red Cross facilitates the submission; PGAI evaluates and determines the claim." },
      { type: "steps", items: [
        { title: "Notify", text: "Notify Philippine Red Cross of the accident or loss by SMS at 0917-844-6025 or email at membershipclaims@redcross.org.ph within 30 days of the accident or loss." },
        { title: "Submit", text: "Submit the required claim documents to the nearest Philippine Red Cross Chapter within 60 days from the accident date for outpatient cases, or from the date of discharge if hospitalized." },
        { title: "Document", text: "Provide complete, truthful, and legible supporting documents. PRC and PGAI may request additional documents where necessary for processing." },
        { title: "Assessment", text: "Philippine Red Cross facilitates the submission; PGAI evaluates coverage and determines the claim in accordance with the applicable policy." },
        { title: "Decision", text: "A valid claim is processed according to the applicable insurance rules. If a claim is denied or limited, the member should request the written basis from PGAI and may pursue available remedies under applicable law." },
      ] },
      { type: "h3", text: "Claims contacts" },
      { type: "table", head: ["Channel", "Contact"], firstColumnHeader: true, rows: [
        ["Email", "maabclaims@redcross.org.ph"],
        ["Telephone", "(+63 2) 8790-2300 local 184"],
        ["Mobile/SMS", "(+63 917) 844-6025"],
        ["Initial incident notification", "membershipclaims@redcross.org.ph / members@redcross.org.ph"],
      ] },
      { type: "p", text: "Use official Philippine Red Cross channels and retain proof of your notification/submission." },
    ],
  },
  {
    id: "documents",
    number: "07",
    title: "Claim document checklist",
    page: 15,
    blocks: [
      { type: "p", text: "The exact requirements depend on the claim type. The following reflects the current Philippine Red Cross-published checklist and may be supplemented by the insurer when reasonably required under the policy." },
      { type: "claimDocs", rows: [
        { claim: "Daily Hospital Allowance — Natural Illness / Pre-Existing", chapter: CHAPTER_PROVIDES, items: [
          "Photocopy of MAAB ID card",
          "Medical Certificate (original copy)",
          "Hospital Statement of Account (photocopy), if hospitalization is due to pre-existing sickness and occurring not more than 6 months from date of membership of present PRC ID",
          "Other related documents",
        ] },
        { claim: "Medical Reimbursement & Daily Hospital Allowance — Confined Due to Accident", chapter: CHAPTER_PROVIDES, items: [
          "Photocopy of MAAB ID card",
          "Medical Certificate (original copy)",
          "Hospital Statement of Account (photocopy)",
          "Hospital Records (photocopy)",
          "Doctor's Prescription (photocopy)",
          "Medical Bills & Receipts with breakdown of items purchased (original copy)",
          "Police Investigation/Statement of Witness (original copy)",
          "Other related documents",
        ] },
        { claim: "Death Claim — Confined Due to Accident", chapter: CHAPTER_PROVIDES, items: [
          "Photocopy of MAAB ID card",
          "Medical Certificate (original copy)",
          "Hospital Statement of Account (photocopy)",
          "Hospital Records (photocopy)",
          "Doctor's Prescription (original copy)",
          "Medical Bills & Receipts (original copy)",
          "Police Investigation/Statement of Witness (original copy)",
          "Death Certificate (original/certified true copy by civil registrar)",
          "Birth Certificate of the Insured and Beneficiary(ies) (original/certified true copy by civil registrar)",
          "Marriage Contract, if married (original/certified true copy by civil registrar)",
          "Burial Receipts (photocopy)",
          "Newspaper Clippings, if any",
          "Other related documents",
        ] },
        { claim: "Death Claim — Dead on Arrival", chapter: CHAPTER_PROVIDES, items: [
          "Photocopy of MAAB ID card",
          "Medical Certificate (original copy)",
          "Police Investigation/Statement of Witness (original copy)",
          "Death Certificate (original/certified true copy by civil registrar)",
          "Birth Certificate of the Insured and Beneficiary(ies) (original/certified true copy by civil registrar)",
          "Marriage Contract, if married (original/certified true copy by civil registrar)",
          "Burial Receipts (photocopy)",
          "Newspaper Clippings, if any",
          "Other related documents",
        ] },
      ] },
      { type: "h3", text: "Authenticity and fraud prevention" },
      { type: "ul", items: [
        "Do not alter, falsify, backdate, or misrepresent any document or incident.",
        "Philippine Red Cross and/or PGAI may validate documents with hospitals, physicians, government offices, police authorities, or other lawful sources.",
        "False statements, fraudulent documents, or material misrepresentation may result in denial of a claim and may have legal consequences under applicable law.",
      ] },
    ],
  },
  {
    id: "exclusions",
    number: "08",
    title: "Limitations, exclusions and waiting periods",
    page: 17,
    blocks: [
      { type: "p", text: "As determined by the PGAI policy." },
      { type: "h3", text: "This plan shall not cover any loss resulting from or related to" },
      { type: "ul", items: [
        "War or war-like operations;",
        "Military or police service, except when not in line of duty;",
        "Willful participation in any crime;",
        "Self-inflicted injury or suicide;",
        "Osteoporosis;",
        "Childbirth, miscarriage, or any pregnancy-related complications;",
        "Accident while under the influence of alcohol or unprescribed drugs;",
        "Hazardous sports (scuba diving, boxing, and the like);",
        "Flying except as a fare-paying passenger in any licensed or private aircraft;",
        "Racing in any form;",
        "Rape, murder, frustrated murder, or any attempt thereof (except for death and disability benefit);",
        "For motorcycling coverage, violation of LTO regulation; or",
        "Dental or plastic surgery (except as a result of accident).",
      ] },
      { type: "h3", text: "Additional exclusion for Daily Hospital Income (DHI) benefit: confinement due to" },
      { type: "ul", items: [
        "Congenital anomalies and conditions arising therefrom;",
        "Routine health checks;",
        "Alcoholism and drug addiction;",
        "AIDS and other sexually transmitted diseases;",
        "Mental or nervous disorders;",
        "Pre-existing illness/conditions (within 6 months from the date of effectivity of coverage); or",
        "Sickness (including dengue — DHI and Accidental Medical Reimbursement benefit) of any kind within 30 days of coverage.",
      ] },
      { type: "h3", text: "High-risk occupations" },
      { type: "p", text: "Acrobats; Army Personnel; Asylum Attendants; Automobile/Motor Racing; Aviators; Boiler men; Custom personnel; Detectives; Scuba Divers; Explosive Makers; Handlers or Custodians; Firemen; Loggers; Policemen; Miners; Sailors; Sawmill Workers; Professional Athletes; Professional Entertainers and Musicians; Secret Service Personnel; Ship's Crew; Fisherman; Linemen; Soldier; Steeplejacks; Underground Workers; Window Cleaners; Woodworking and Metal Working Machinists; and other occupations of similar classifications." },
      { type: "h3", text: "Murder and assault" },
      { type: "p", text: "This plan shall NOT cover POLITICIANS for any losses resulting from murder and/or assault whether provoked or unprovoked. (Not applicable to politicians who are also members of the PRC Board of Directors.)" },
      { type: "h3", text: "Permanent total disability" },
      { type: "p", text: "When bodily injury due to an accident results in the Permanent Total Disablement of the Insured Person within one hundred eighty (180) days after the date of the accident, PGAI will pay the Permanent Total Disablement Indemnity stated in the schedule. This amount will be paid less any other amount paid under the Permanent Disablement Benefit." },
      { type: "ul", items: [
        "Permanent Total Disablement shall mean disablement which entirely prevents the Insured Person from attending to any business or gainful occupation or from attending to any duties which would normally be carried out by him in his daily life.",
        "Permanent shall mean lasting twelve (12) consecutive months from the date of the accidental bodily injury, and at the expiry of the period, remains beyond hope of improvement.",
      ] },
      { type: "h3", text: "Permanent partial disablement benefit" },
      { type: "p", text: "When bodily injury due to an accident of the Insured Person results in one or more injuries as defined in the following Table of Benefits within one hundred eighty (180) days after the date of the accident, PGAI will pay an amount equal to the Permanent Disablement Indemnity stated in the Schedule multiplied by the corresponding Percentage of Benefit Amount per the following Table of Benefits." },
      { type: "table", head: ["Injury", "Percentage of indemnity"], firstColumnHeader: true, rows: [
        ["Permanent and Incurable Paralysis of All Limbs", "100%"],
        ["Permanent Total Loss of Sight of Both Eyes", "100%"],
        ["Permanent Total Loss of Sight of One Eye", "100%"],
        ["Loss of or the Permanent Total Loss of Use of Two Limbs", "100%"],
        ["Loss of or the Permanent Total Loss of Use of One Limb", "100%"],
        ["Loss of Speech and Hearing", "100%"],
        ["Permanent Total Loss of Hearing in Both Ears", "75%"],
        ["Permanent Total Loss of Hearing in One Ear", "25%"],
        ["Permanent and Incurable Insanity", "100%"],
        ["Permanent Total Loss of the Lens of One Eye", "50%"],
        ["Loss of or the Permanent Total Loss of Use of Four Fingers and Thumb of Right Hand", "70%"],
        ["Loss of or the Permanent Total Loss of Use of Four Fingers and Thumb of Left Hand", "50%"],
        ["Loss of or the Permanent Total Loss of Use of Four Fingers of Right Hand", "40%"],
        ["Loss of or the Permanent Total Loss of Use of Four Fingers of Left Hand", "30%"],
        ["Loss of or the Permanent Total Loss of Use of One Thumb — Both Right Phalanges", "30%"],
        ["Loss of or the Permanent Total Loss of Use of One Thumb — One Right Phalanx", "15%"],
        ["Loss of or the Permanent Total Loss of Use of One Thumb — Both Left Phalanges", "20%"],
        ["Loss of or the Permanent Total Loss of Use of One Thumb — One Left Phalanx", "10%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — Three Right Phalanges", "10%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — Two Right Phalanges", "7.5%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — One Right Phalanx", "5%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — Three Left Phalanges", "7.5%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — Two Left Phalanges", "7%"],
        ["Loss of or the Permanent Total Loss of Use of Fingers — One Left Phalanx", "2%"],
        ["Loss of or the Permanent Total Loss of Use of Toes — All of One Foot", "15%"],
        ["Loss of or the Permanent Total Loss of Use of Toes — Great, Both Phalanges", "5%"],
        ["Loss of or the Permanent Total Loss of Use of Toes — Great, One Phalanx", "3%"],
        ["Fractured Leg or Patella with Established Non-Union", "10%"],
        ["Shortening of Leg by at least 5 cm", "7.5%"],
      ] },
      { type: "h3", text: "Additional rules" },
      { type: "ul", items: [
        "In the event of partial loss of any member or members specified above, a proportionately lower percentage of compensation shall be payable.",
        "If the Insured Person is left-handed, the percentages relating to the right arm or right hand shall apply to the left hand or left arm respectively, and vice versa.",
        "When more than one infirmity arises from one accident, the Company shall pay only one loss, said loss being the greatest one.",
      ] },
      { type: "h3", text: "Definitions" },
      { type: "ul", items: [
        "Permanent shall mean lasting twelve (12) calendar months from the date of Accident and at the expiry of that period being beyond hope of improvement.",
        "Loss of Sight of Eyes shall mean the entire and irrecoverable loss of sight.",
        "Loss of Speech shall mean the disability in articulating any three of the four sounds which contribute to speech (Labial sounds, Alveolabial sounds, Palatal sounds, and Velar sounds) or total loss of vocal cord or damage to the speech center in the brain resulting in Aphasia.",
        "Loss of Hearing means permanent irrecoverable loss of hearing.",
        "Loss of Limb means loss by physical severance of a hand at or above the wrist or of a foot above the ankle.",
        "Loss of Fingers or Toes means complete severance through or above the metacarpophalangeal joints or metatarsophalangeal joints.",
        "Loss of Use means total functional disablement/loss of use of a limb or organ and is treated like the total loss of said limb or organ.",
      ] },
      { type: "callout", tone: "warn", text: "Important legal rule: Never rely on this summary to decide whether a claim is covered. The member should obtain or request the current certificate/master policy wording and schedule applicable to the Safe Card membership year. If this Guide conflicts with the PGAI policy, the PGAI policy controls. Philippine Red Cross will not represent that an event is covered merely because it appears generally similar to a benefit listed in this Guide. Coverage is determined by PGAI from the applicable policy terms and facts of the claim." },
    ],
  },
  {
    id: "privacy",
    number: "09",
    title: "Privacy and information handling",
    page: 22,
    blocks: [
      { type: "p", text: "Safe Card registration and claims may require personal and sensitive personal information. Philippine Red Cross and PGAI may process information necessary for membership administration, eligibility, service delivery, claims processing, fraud prevention, legal/regulatory compliance, recordkeeping, and related legitimate purposes, subject to the Data Privacy Act of 2012 and applicable regulations." },
      { type: "h3", text: "Member notice" },
      { type: "table", head: ["Principle", "Commitment"], firstColumnHeader: true, rows: [
        ["Transparency", "You should be informed about what information is collected, why it is collected, how it is processed, and who may receive it."],
        ["Legitimate purpose", "Information should be processed only for specified and legitimate purposes."],
        ["Proportionality", "Collection should be adequate, relevant, and not excessive for the stated purpose."],
        ["Security", "Philippine Red Cross and relevant processors/partners, including PGAI, should apply appropriate organizational, physical, and technical safeguards."],
        ["Claims sharing", "Information may need to be shared with PGAI, hospitals, physicians, government authorities, service providers, or other lawful recipients when necessary for the stated purposes or permitted/required by law."],
        ["Data-subject rights", "Members have rights under applicable privacy law, including rights to be informed and to access/correct personal information, subject to lawful limitations."],
      ] },
      { type: "h3", text: "Privacy contact and official channels" },
      { type: "p", text: "For privacy requests, use the current official Philippine Red Cross privacy/contact channels published by Philippine Red Cross. Do not send sensitive medical or identity documents through unofficial social-media accounts or personal numbers." },
      { type: "callout", tone: "info", text: "This Guide does not replace Philippine Red Cross's formal Privacy Notice or PGAI's applicable insurer privacy notice." },
    ],
  },
  {
    id: "legal",
    number: "10",
    title: "Important legal terms",
    page: 23,
    blocks: [
      { type: "p", text: "These provisions are intended to reduce ambiguity and ensure that members understand the distinct nature of membership, emergency services and insurance coverage." },
      { type: "table", head: ["Term", "What it means"], firstColumnHeader: true, rows: [
        ["Membership relationship", "The Safe Card is a Philippine Red Cross membership/fund-drive program. Membership does not create an unconditional contract for the delivery of every Philippine Red Cross service at every place and time."],
        ["Insurance relationship", "Accident assistance benefits are provided under the applicable insurance arrangement. The insurer, not Philippine Red Cross, determines insurance coverage and claims liability under the policy, subject to applicable law."],
        ["No guarantee of resource availability", "Ambulance and blood assistance depend on actual operational and inventory availability, selected service areas, distance from the scene, traffic/logistics, medical considerations and other operational conditions."],
        ["No guarantee of response time", "Calling 143 initiates a request for assistance; it does not guarantee a particular arrival time, transport outcome, destination or resource availability."],
        ["No transfer / assignment", "The Safe Card is personal to the registered member and is non-transferable, non-assignable and may not be used by another person."],
        ["Policy controls", "This Guide is a plain-language member communication. The master policy, certificate/schedule, endorsements and insurer-approved terms control insurance coverage."],
        ["Lawful remedies preserved", "Nothing in this Guide is intended to waive rights or remedies that cannot lawfully be waived under Philippine law."],
        ["Program changes", "Philippine Red Cross may update operational procedures, contact channels and service arrangements. Changes to insurance coverage are governed by the applicable policy, endorsements and lawful agreement with the insurer."],
      ] },
      { type: "p", text: "For disputes concerning insurance coverage or claim settlement, members may use the complaint and assistance mechanisms available under applicable Philippine insurance laws and regulations, including the Insurance Commission where appropriate." },
    ],
  },
  {
    id: "acknowledgment",
    number: "11",
    title: "Member acknowledgment",
    page: 24,
    blocks: [
      { type: "p", text: "By registering for or using the Safe Card, the member acknowledges that he/she has been given access to this Guide and understands the following key conditions:" },
      { type: "ul", items: [
        "I understand that the Safe Card is a Philippine Red Cross membership with specified accident assistance benefits.",
        "I understand that the Safe Card is NON-TRANSFERABLE and may only be used by the registered member.",
        "I understand that insurance benefits are subject to the applicable master policy, certificate, exclusions, limits, waiting periods and claim requirements.",
        "I understand that ambulance and blood assistance are subject to actual availability, selected service areas, distance from the scene, operational capacity, medical considerations and logistics.",
        "I understand that Philippine Red Cross facilitates membership and Philippine Red Cross emergency services, while the insurer determines insurance coverage and claims under the applicable policy.",
        "I agree to provide truthful and complete information and authentic supporting documents.",
      ] },
      { type: "h3", text: "Official contacts" },
      { type: "table", head: ["Channel", "Contact"], firstColumnHeader: true, rows: [
        ["Emergency", "143"],
        ["Safe Card / Claims", "(+63 2) 8790-2300 local 184 · (+63 917) 844-6025"],
        ["Claims email", "maabclaims@redcross.org.ph"],
        ["Address", "Philippine Red Cross, 37 EDSA corner Boni Avenue, Mandaluyong City 1550"],
      ] },
    ],
  },
  {
    id: "directory",
    number: "",
    title: "Chapter directory",
    page: 25,
    blocks: [
      { type: "p", text: "The PDF lists every Philippine Red Cross chapter with its address and email, the blood centers, and the ambulance units by chapter." },
      { type: "callout", tone: "info", text: "Ambulance unit/s per chapter may vary due to operational assignment and augmentation." },
      { type: "pdfLink", label: "Open the chapter directory in the PDF", page: 25 },
    ],
  },
] as const;

export const GUIDE_SECTION_IDS = guideSections.map((section) => section.id);
