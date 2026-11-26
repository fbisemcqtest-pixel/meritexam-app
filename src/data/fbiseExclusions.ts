import { ExamBoard, GradeLevel, SubjectName } from '../types';

export interface FbiseSubjectExclusionProfile {
  /** Whole chapters/units marked 100% Formative or PBA-only (zero annual written theory exam questions). */
  excludedWholeChapters: string[];
  /** Specific SLOs / sub-topics within summative chapters marked Formative or PBA-Only (must NEVER appear in theory papers). */
  excludedTopicsPrompt: string[];
  /** Authentic FBISE Assessment Framework & Model Paper structural rules for this grade+subject. */
  importantPaperRules: string[];
}

const PROFILES: Partial<Record<GradeLevel, Partial<Record<SubjectName, FbiseSubjectExclusionProfile>>>> = {
  '9th': {
    Physics: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Lab measuring instrument handling & practical procedures (P-09-A-12 to P-09-A-16, P-09-A-19): Vernier calipers reading/zero error practical, micrometer screw gauge practical, measuring cylinder reading, pendulum period multiple oscillations lab, analog instrument least-count lab — these are Summative for PBA ONLY, NOT in written theory paper.',
        'Practical measurement tasks in Forces/Mechanics (P-09-B-21, P-09-B-22, P-09-B-48, P-09-B-57): electronic balance calibration/use, force meter practical, plumb line center-of-gravity experiment, load-extension spring plotting — Summative for PBA ONLY.',
        'All Domain N Experimentation Skills (P-09-10-N-01 to P-09-10-N-49): lab hazards, safety rules, graph plotting techniques, experimental error minimization — excluded from written annual theory exam.',
      ],
      importantPaperRules: [
        'Generate conceptual SLO-based theory, derivations, and numericals ONLY from Summative for Theory Domains (A–F).',
      ],
    },
    Chemistry: {
      excludedWholeChapters: [
        'Empirical Data Collection and Analysis',
        'Separation Techniques',
        'Qualitative Analysis',
        'Chromatography',
      ],
      excludedTopicsPrompt: [
        'WHOLE CHAPTERS EXCLUDED FROM WRITTEN THEORY EXAM: Empirical Data Collection and Analysis (C-09-F-01..08), Separation Techniques (C-09-F-09..14), Qualitative Analysis (C-09-F-15..16), and Chromatography (C-09-F-17..20) are 100% Formative or Summative for PBA Only — do NOT generate written theory questions from them.',
        'C-09-A-04 (Formative): Differentiating science, technology, and engineering.',
        'C-09-B-10 & C-09-B-12 (Formative): Quantum probabilistic electron paths / atomic model as an aid.',
        'C-09-D-12 to C-09-D-14 (PBA-Only): Chemical tests for water using anhydrous CuSO4, testing purity of water by melting/boiling point, and distilled vs tap water lab comparison.',
        'All Domain G Practical/Lab Skills (C-09-10-G-01..32): PPE, lab apparatus handling, filtration/distillation/titration hands-on lab procedures.',
      ],
      importantPaperRules: [
        'Annual Theory Paper covers ONLY Summative-for-Theory units (Nature of Science in Chemistry, Matter, Atomic Structure, Periodic Table, Chemical Bonding, Stoichiometry, Electrochemistry, Energetics, Chemical Equilibrium, Acids/Bases/Salts, Environmental Chemistry Air/Water, Organic Chemistry, Hydrocarbons, Biochemistry).',
      ],
    },
    Biology: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'B-09-B-04 (Formative): Historical account of HMS Beagle voyage.',
        'All Domain X Practical Skills (B-09-10-X): Light microscope focusing/magnification lab procedures, osmosis potato strip lab, starch/food test bench procedures, biological drawing/specimen handling — Summative for PBA Only.',
      ],
      importantPaperRules: [
        'Focus on Summative-for-Theory biological concepts, labelled conceptual mechanisms, cell organelles, enzyme action, nutrition, and evolution.',
      ],
    },
    Math: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Formative introductory/recall & manual drawing SLOs (M-09-A-01..03, M-09-A-06, M-09-A-12, M-09-A-17, M-09-C-01): introductory number-line storytelling, rough estimates, manual survey data collection.',
        'Hands-on compass/protractor triangle & polygon physical construction steps requiring physical geometry box drawing (M-09-B-13..15, M-09-B-28..30) — treat only theorem proofs, angle/bearing calculations, coordinate geometry, and algebraic problems as written theory questions.',
      ],
      importantPaperRules: [
        'Under New FBISE 50/50 (2026–27): 48 MCQs × 0.75 = 36 Marks (incl. 16 scenario-based), 7 Short × 3 = 21 Marks, 3 Long × 6 = 18 Marks; under Inclusive Scheme 2024: 15 MCQs + 9 × 4 + 3 × 8 = 75 Marks.',
      ],
    },
    'Computer Science': {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Hands-on IDE compilation, physical lab hardware assembly, keyboard typing speed drills, and live HTML/JS browser debugging demonstrations are assessed in PBA ONLY — do NOT ask practical computer-lab operation tasks.',
      ],
      importantPaperRules: [
        'Written theory paper tests architecture, logic gates, flowcharts, dry-running/trace tables, written HTML/CSS/JS syntax & output prediction, data modeling, AI concepts, and digital entrepreneurship.',
      ],
    },
    English: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Speaking, listening comprehension audio, oral presentation, pronunciation drills, peer brainstorming, and book-review Formative SLOs are NOT part of the written annual exam.',
        'Do NOT ask rote recall "textbook lesson summary" questions from prose chapters — FBISE tests UNSEEN comprehension and applied language skills.',
      ],
      importantPaperRules: [
        'Section B starts with an UNSEEN prose comprehension passage followed by poetic stanza questions and applied grammar/punctuation; Section C tests essay/paragraph, formal letter/application, dialogue, and translation/correction.',
      ],
    },
    Urdu: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'زبانی تقریر، سماعت، املا کی عملی مشق اور غیر امتحانی تشکیلی (Formative) سرگرمیاں سالانہ تحریری پرچے میں شامل نہیں۔',
      ],
      importantPaperRules: [
        'فیڈرل بورڈ امڈل پیپر کے مطابق حصہ معروضی (15 ایم سی کیوز)، حصہ دوم (نثر 7، نظم و غزل 5، قواعد 3 — کل 15 مختصر سوالات یا نثری/شعری تفہیم) اور حصہ سوم تفصیلی سوالات (سیاق و سباق، تشریح اشعار، درخواست/مضمون) شامل کریں۔',
      ],
    },
    Islamiat: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Tarjuma-tul-Quran-ul-Majeed is a separate 50-mark paper — do NOT include separate Tarjuma-tul-Quran syllabus chapters inside Islamiat Compulsory.',
        'Psychomotor and Affective / practical character-observation activities marked Formative in the framework are NOT in the written exam; test ONLY Cognitive/Knowledge summative SLOs.',
        'Asma-ul-Husna (اسمائے حسنیٰ کے معانی) appear ONLY in Section A MCQs, not subjective long questions.',
      ],
      importantPaperRules: [
        'Include authentic Quranic/Hadith-based conceptual MCQs, concise 3-mark SRQs, and detailed Seerat/Akhlak/Ahkam extended questions plus selected Ahadith translation & explanation.',
      ],
    },
  },

  '10th': {
    Physics: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'P-10-C-20 (PBA-Only): Experimental determination of specific latent heat.',
        'P-10-C-28 & P-10-C-29 (Formative): Superconductivity concepts and applications.',
        'P-10-F-25 (Formative): Geothermal activity details.',
        'P-10-D-31, P-10-D-39, P-10-D-53, P-10-D-56, P-10-D-57, P-10-D-58 (Formative / PBA-Only): Human ear sound transduction, rectangular glass block refraction lab procedure, single lens optical device applications, biological colour vision mechanisms, gravitational black hole lensing, acoustic lenses.',
        'P-10-E-19, P-10-E-25, P-10-E-29, P-10-E-32, P-10-E-47, P-10-E-55, P-10-E-56, P-10-E-60, P-10-E-62, P-10-E-68, P-10-E-69 (Formative / PBA-Only): Types of lightning, ammeter/voltmeter/resistance practical setup, household wiring safety/fuses/circuit-breakers/electric shock, magnetic relays, Boolean switch combinations, npn transistor switch circuit lab.',
        'All Domain N Experimentation Skills (P-09-10-N): apparatus setup, error analysis, and lab safety.',
      ],
      importantPaperRules: [
        'FBISE SSC-II Physics Inclusive Scheme 2024 is 60 Marks (12 MCQs + 10 × 3 Short + 3 × 6 Long with OR); New 50/50 Pattern is 60 MCQs × 0.5 + 6 × 3 Short + 2 × 6 Long = 60 Marks.',
      ],
    },
    Chemistry: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'C-10-A-01 to C-10-A-04 (Formative): Community of inquiry, scientific paradigm shifts, confidence levels, repeatability vs reproducibility.',
        'C-10-B-08 (PBA-Only): Practical sublimation applications & lab separation.',
        'C-10-B-13 (PBA-Only): Titration experimental calculations using practical burette/pipette readings (note: C-10-B-12 general stoichiometry & C-10-B-14 empirical/molecular formula ARE summative!).',
        'C-10-B-28 (Formative): Describing collision theory wording in general — stick to summative factors affecting reaction rate and activation energy.',
        'C-10-C-02 (Formative): NO/NO2 acid rain formation details marked Formative.',
        'C-10-E-33, C-10-E-34, C-10-E-38 (Formative): PET condensation polymer structure/depolymerization and non-summative biochemistry details.',
        'All Domain G Practical/Lab Skills (C-09-10-G): salt analysis benchwork, titration lab steps, gas collection tests.',
      ],
      importantPaperRules: [
        'FBISE SSC-II Chemistry Inclusive Scheme 2024 is 60 Marks (12 MCQs + 10 × 3 Short + 3 × 6 Long with OR); New 50/50 Pattern is 60 MCQs × 0.5 + 6 × 3 Short + 2 × 6 Long = 60 Marks.',
      ],
    },
    Biology: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'B-10-H-04 (Formative): Sex determination in humans.',
        'B-10-H-05 (PBA-Only): Sketching structure of chromosomes as practical lab task.',
        'B-10-K-03 (PBA-Only): Sketching bar charts from ecological lab data.',
        'All Domain X Practical Skills (B-09-10-X): dissection, spirometer lab, urine Benedict/biuret practical steps.',
      ],
      importantPaperRules: [
        'FBISE SSC-II Biology Inclusive Scheme 2024 is 60 Marks (12 MCQs + 10 × 3 Short + 3 × 6 Long with OR); New 50/50 Pattern is 60 MCQs × 0.5 + 6 × 3 Short + 2 × 6 Long = 60 Marks.',
      ],
    },
    Math: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Formative SLOs M-10-A-53 and M-10-B-01..04, M-10-B-08 (introductory/manual geometric locus construction activities marked Formative).',
      ],
      importantPaperRules: [
        'FBISE SSC-II Math New 50/50 Pattern is 75 Marks (48 MCQs × 0.75 = 36 + 7 × 3 = 21 + 3 × 6 = 18); Inclusive Scheme 2024 is 15 MCQs + 9 × 4 + 3 × 8 = 75 Marks.',
      ],
    },
    'Computer Science': {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Hands-on IDE execution, live database GUI wizard steps, and practical typing/networking cabling tasks are assessed in PBA ONLY.',
      ],
      importantPaperRules: [
        'FBISE SSC-II Computer Science Inclusive Scheme 2024 is 60 Marks (12 MCQs + 10 × 3 Short + 3 × 6 Long with OR); New 50/50 Pattern is 60 MCQs × 0.5 + 6 × 3 Short + 2 × 6 Long = 60 Marks.',
      ],
    },
    English: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Oral speaking, listening activities, process-drafting brainstorming, and rote textbook Q&As are excluded — test unseen comprehension, grammar, translation/correction, letter/report/essay.',
      ],
      importantPaperRules: [
        'Active FBISE SSC-II English Model Paper is 75 Marks (Section A 15, Section B 39–40, Section C 20–21).',
      ],
    },
    Urdu: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'زبانی سرگرمیاں، سماعت اور تشکیلی (Formative) مشقیں سالانہ تحریری امتحان میں شامل نہیں۔',
      ],
      importantPaperRules: [
        'نثری و شعری تفہیم، قواعد اور تحریری مہارتوں پر مبنی فیڈرل بورڈ ایس ایس سی دوم کا 75 نمبر کا ماڈل پیپر تیار کریں۔',
      ],
    },
    Islamiat: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Do NOT include Tarjuma-tul-Quran chapters or Psychomotor/Affective Formative SLOs.',
      ],
      importantPaperRules: [
        'Follow official FBISE Islamiat Compulsory written paper assessment rules.',
      ],
    },
  },

  '1st A': {
    Physics: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'P-11-A-01 (Formative): Order-of-magnitude rough estimation exercises.',
        'P-11-B-03, P-11-B-11, P-11-B-39 (Formative): Basic introductory kinematics/momentum/Bernoulli conceptual warmups marked Formative (test full summative derivations & problems instead).',
        'P-11-D-10, P-11-D-19 to P-11-D-21 (Formative / PBA-Only): Stationary wave lab experiments, gravitational waves and laser interferometers (LIGO) details.',
        'P-09-E-09 (Formative): Ferrofluids.',
        'P-11-F-06, P-11-F-22 to P-11-F-27 (Formative): 4D spacetime introductory essays, contending theories of mass/force, particle accelerator engineering, matter-antimatter asymmetry.',
        'All Domain N Experimentation Skills (P-11-N-01..28): Vernier/screw gauge/oscilloscope practical lab procedures & uncertainty graphing — PBA Only.',
      ],
      importantPaperRules: [
        'FBISE HSSC-I Physics New 50/50 Pattern is 80 Marks (80 MCQs × 0.5 + 7 × 4 + 2 × 6); Inclusive Scheme 2024 is 17 MCQs + 13 × 3 + 4 × 6 = 80 Marks.',
      ],
    },
    Chemistry: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'C-11-B-61, C-11-B-66, C-11-B-72, C-11-B-81, C-11-B-97, C-11-B-103, C-11-B-111, C-11-B-121, C-11-B-124 (Formative): General liquid/gas descriptions, calorimetry practical experiment steps, basic Gibbs free energy essays, macroscopic vs microscopic comparison.',
        'C-11-B-146 (PBA-Only): Performing acid-base titrations in lab.',
        'C-11-C-21, C-11-C-28, C-11-C-34, C-11-C-40 (Formative): Halogen colours/volatility recall, Cl2 + cold/hot NaOH disproportionation, N2 triple-bond inertness essay, nitrification vs denitrification.',
        'C-11-D-01, C-11-D-05, C-11-D-13, C-11-D-14, C-11-D-20, C-11-D-22 (Formative): Air/water pollution regulations, socioeconomic/political impact, atmospheric composition recall.',
        'C-11-E-23 (Formative): Introductory isomerism/stereoisomerism definitions marked Formative.',
        'All Domain G Lab Skills: Volumetric analysis, qualitative salt tests — PBA Only.',
      ],
      importantPaperRules: [
        'FBISE HSSC-I Chemistry New 50/50 Pattern is 80 Marks (80 MCQs × 0.5 + 7 × 4 + 2 × 6); Inclusive Scheme 2024 is 17 MCQs + 13 × 3 + 4 × 6 = 80 Marks.',
      ],
    },
    Biology: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Formative Diversity & Classification topics (B-11-B-09, B-11-B-14, B-11-B-15, B-11-B-17, B-11-B-18, B-11-B-22): Polytrichum/Pinus/angiosperm detailed life cycles and plant family classification lists.',
        'Formative Biomolecules/Cells/Enzymes/Bioenergetics SLOs (B-11-C-02/04/08/23/28; B-11-D-01/09/12/13/16/17; B-11-F-07/08 PBA enzyme exps; B-11-F-10/16/19/28..35 pigments/PS-I-II/photorespiration/C4).',
        'Formative Genetics/Inheritance & Prokaryotes/Protists/Viruses/Plant Nutrition (B-11-H-06..11, 16..23, 29, 30, 35, 39, 45, 51, 54, 55; B-11-N-03..21 Ecology of Pakistan; B-11-O-01..33 Bacteria/Protists/Fungi classification PBA; B-11-P-01..22 Virus discovery/flu vaccine; B-11-Q-01/06/20 mineral nutrition & PGRs).',
        'All Domain X Lab Skills (B-11-X): Slide mounting, chromatography of leaf pigments, microscopy drawing — PBA Only.',
      ],
      importantPaperRules: [
        'Focus strictly on Summative HSSC-I SLOs. New 50/50 Pattern: 80 MCQs × 0.5 + 7 × 4 + 2 × 6 = 80 Marks; Inclusive Scheme 2024: 17 + 13 × 3 + 4 × 6 = 80 Marks.',
      ],
    },
    Math: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Formative SLOs (M-11-A-01..06, M-11-A-10, M-11-A-15, M-11-A-24, M-11-A-26, M-11-A-28, M-11-A-31, M-11-A-36, M-11-B-01, M-11-B-03, M-11-B-04): introductory exploratory exercises and basic graphing checks marked Formative.',
      ],
      importantPaperRules: [
        'FBISE HSSC-I Math New 50/50 Pattern is 100 Marks (64 MCQs × 0.75 = 48 + 7 × 4 = 28 + 3 × 8 = 24); Inclusive Scheme 2024 is 20 + 12 × 4 + 4 × 8 = 100 Marks.',
      ],
    },
    'Computer Science': {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Live IDE coding sessions, hardware lab assembly, and keyboarding drills belong to PBA ONLY — test Python code tracing, algorithms, ER diagrams, IoT/Blockchain concepts in written theory.',
      ],
      importantPaperRules: [
        'FBISE HSSC-I Computer Science New 50/50 Pattern is 80 Marks (80 MCQs × 0.5 + 7 × 4 + 2 × 6); Inclusive Scheme 2024 is 17 MCQs + 13 × 3 + 4 × 6 = 80 Marks.',
      ],
    },
    English: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Listening/speaking dialogues, oral group discussions, and process-brainstorming activities are Formative and NOT in the written board paper.',
      ],
      importantPaperRules: [
        'Use ONLY NBF HSSC-I units & unseen comprehension passages, poetry stanzas, précis writing, essay, and formal report/letter writing (Total 100 Marks).',
      ],
    },
    Urdu: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'زبانی گفتار، سماعت اور تشکیلی (Formative) سرگرمیاں سالانہ تحریری پرچے میں شامل نہیں۔',
      ],
      importantPaperRules: [
        'ایچ ایس ایس سی اول ماڈل پیپر (100 نمبر): حصہ معروضی 20 نمبر، حصہ دوم (نثر 24، نظم 12، غزل 4/6، قواعد 8) اور حصہ سوم تفصیلی سوالات و تشریحات۔',
      ],
    },
    Islamiat: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Tarjuma-tul-Quran is a separate paper — exclude it from Islamiat Compulsory. Exclude Psychomotor/Affective Formative SLOs.',
      ],
      importantPaperRules: [
        'Official HSSC-I Islamiat Compulsory Model Paper is 50 Marks (10 MCQs + 6 × 3 Short + 2 × 8 Long + 6 Hadith/Note = 50 Marks, 2:30 hrs).',
      ],
    },
  },

  '2nd Year': {
    Physics: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'P-12-C-05 & P-12-C-06 (Formative): Origin of statistical mechanics / breakdown at extreme temperatures.',
        'P-12-D-17 & P-12-D-25 (Formative): Rubens tube, Chladni plates, acoustic levitation demonstrations; philosophical Copenhagen vs Many-Worlds debate.',
        'P-12-E-08 & P-12-E-09 (PBA-Only): RC capacitor exponential decay equation x = x0 exp(-t/RC) & discharging/charging curve plotting — Summative for PBA ONLY.',
        'P-10-E-11 to P-10-E-13 (Formative): Bioelectricity, Electrophorus, animal electroreception.',
        'P-12-F-40, P-12-F-45, P-12-F-51, P-12-F-59, P-12-F-60, P-12-F-65 (Formative): PET scan details, standard candles, Hubble law & Big Bang narrative, thermohaline circulation, butterfly chaos climate, CT scan operational steps.',
        'P-12-G-01 to P-12-G-04 (Formative): Nature of Science mathematical beauty & thought-experiment debate.',
        'All Domain N Experimentation Skills (P-12-N): CRO, meter bridge, potentiometer lab procedures — PBA Only.',
      ],
      importantPaperRules: [
        'FBISE HSSC-II Physics Inclusive Scheme 2024 is 80 Marks (17 MCQs + 13 × 3 + 4 × 6 with OR); New 50/50 Pattern is 80 MCQs × 0.5 + 7 × 4 + 2 × 6 = 80 Marks.',
      ],
    },
    Chemistry: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'C-12-A-01 to C-12-A-03 (Formative): Cognitive biases/fallacies, chemical ethics, argument deconstruction.',
        'C-12-B-08, C-12-B-09, C-12-B-19, C-12-B-22, C-12-B-23, C-12-B-26 (Formative): Winkler BOD method, basic electrolytic cell conversion, Nernst equation calculations, common ion effect, Ka calculations, Ksp slightly soluble salt concentration.',
        'C-12-C-12, C-12-C-18, C-12-C-31, C-12-C-41, C-12-C-42, C-12-C-47 (Formative): Complex ion Group 2 application, sketching 3dxy/3dxz orbitals, qualitative ligand exchange Cu/Co, complex stereoisomerism (Note: Kstab expression & calculation C-12-C-45/46 ARE summative!).',
        'C-12-C-33, C-12-C-34, C-12-C-36 (PBA-Only): KMnO4 / Fe2+ / oxalate redox titration lab calculations.',
        'C-12-E-08 (Formative): Drug chirality & thalidomide/synthetic isomers.',
        'C-12-E-24, C-12-E-27(e), C-12-E-32 (Formative/PBA): Halogenoalkane bond-strength reactivity trend, part (e) of phenol (parts a–d ARE summative!), reactions of other phenolics.',
        'C-12-E-58, C-12-E-59, C-12-E-60, C-12-E-65 (Formative): PVC/nylon industrial processes, acyl chloride + amine condensation, Pakistan common chemical industries overview, polymer disposal issues.',
      ],
      importantPaperRules: [
        'FBISE HSSC-II Chemistry Inclusive Scheme 2024 is 80 Marks (17 MCQs + 13 × 3 + 4 × 6 with OR); New 50/50 Pattern is 80 MCQs × 0.5 + 7 × 4 + 2 × 6 = 80 Marks.',
      ],
    },
    Biology: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'B-12-J-07 & B-12-J-08 (Formative): Vertical farming concepts & benefits.',
        'B-12-K-05 & B-12-K-08 (PBA-Only): Plotting error bars / designing experimental investigations.',
        'B-12-L-02 & B-12-L-03 (Formative): X-ray crystallography principles.',
        'B-12-T-02 (PBA-Only): Experimental testing of 4 classes of antibiotics.',
        'B-12-V-01 to B-12-V-03 (Formative): Biowarfare, biodefense, genomics/proteomics/omics overview.',
        'All Domain X Lab Skills (B-12-X): Dissection, slide identification lab, PCR practical bench steps — PBA Only.',
      ],
      importantPaperRules: [
        'FBISE HSSC-II Biology Inclusive Scheme 2024 is 80 Marks (17 MCQs + 13 × 3 + 4 × 6 with OR); New 50/50 Pattern is 80 MCQs × 0.5 + 7 × 4 + 2 × 6 = 80 Marks.',
      ],
    },
    Math: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Formative SLOs (M-12-A-01..11, M-12-A-18, M-12-A-27, M-12-A-32, M-12-A-35, M-12-A-48, M-12-A-57, M-12-A-58): introductory exploratory tasks and software-plotting steps marked Formative.',
      ],
      importantPaperRules: [
        'FBISE HSSC-II Math New 50/50 Pattern is 100 Marks (64 MCQs × 0.75 = 48 + 7 × 4 + 3 × 8); Inclusive Scheme 2024 is 20 MCQs + 12 × 4 + 4 × 8 = 100 Marks.',
      ],
    },
    'Computer Science': {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Live IDE coding sessions, database GUI labs, and project presentation deliverables are PBA ONLY.',
      ],
      importantPaperRules: [
        'FBISE HSSC-II Computer Science Inclusive Scheme 2024 is 80 Marks (17 MCQs + 13 × 3 + 4 × 6 with OR); New 50/50 Pattern is 80 MCQs × 0.5 + 7 × 4 + 2 × 6 = 80 Marks.',
      ],
    },
    English: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Speaking/listening/peer-review activities are Formative and excluded from written board papers.',
      ],
      importantPaperRules: [
        'Active FBISE HSSC-II English Model Paper is 100 Marks (20 MCQs + 40 Section B + 40 Section C with unseen comprehension & writing).',
      ],
    },
    Urdu: {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'زبانی سرگرمیاں اور تشکیلی (Formative) مشقیں سالانہ پرچے میں شامل نہیں۔',
      ],
      importantPaperRules: [
        'ایچ ایس ایس سی دوم ماڈل پیپر (100 نمبر): حصہ معروضی 20، حصہ دوم (نثر 18، نظم 9، غزل 6، قواعد 6 = 39) اور حصہ سوم 41 نمبر۔',
      ],
    },
    'Pakistan Studies': {
      excludedWholeChapters: [],
      excludedTopicsPrompt: [
        'Affective/value-discussion classroom roleplay activities marked Formative are excluded; focus on Cognitive historical, constitutional, economic, and foreign-policy SLOs.',
      ],
      importantPaperRules: [
        'Official FBISE HSSC-II Pakistan Studies Model Paper is 50 Marks (10 MCQs + 8 × 3 Short + 2 × 8 Long = 50 Marks).',
      ],
    },
  },
};

export function getFbiseExclusionProfile(
  grade: GradeLevel,
  subject: SubjectName,
): FbiseSubjectExclusionProfile | null {
  return PROFILES[grade]?.[subject] ?? null;
}

export function isFbiseExcludedChapter(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
  chapterName: string,
): boolean {
  if (board !== 'fbise_nbf') return false;
  const profile = getFbiseExclusionProfile(grade, subject);
  if (!profile) return false;
  const normalized = chapterName.trim().toLowerCase();
  return profile.excludedWholeChapters.some((ex) => ex.trim().toLowerCase() === normalized);
}

export function getSummativeFbiseChapters(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
  chapters: string[],
): string[] {
  if (board !== 'fbise_nbf') return chapters;
  return chapters.filter((ch) => !isFbiseExcludedChapter(board, grade, subject, ch));
}

export function buildFbiseExclusionPromptBlock(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
  selectedChapters?: string[],
): string {
  if (board !== 'fbise_nbf') return '';

  const profile = getFbiseExclusionProfile(grade, subject);
  const lines: string[] = [
    `FBISE ASSESSMENT FRAMEWORK COMPLIANCE (${grade} ${subject}):`,
    '- Include ONLY "Summative for Theory" and "Summative for Theory and PBA" Student Learning Outcomes (SLOs).',
    '- STRICTLY EXCLUDE every topic marked "Formative" ("Question(s) will not be asked in final examination") or "Summative for PBA Only" (practical laboratory bench work, apparatus handling, practical titrations, or Domain N/G/X experimentation skills).',
  ];

  if (profile) {
    if (profile.excludedWholeChapters.length > 0) {
      const selectedNorm = new Set((selectedChapters ?? []).map((c) => c.trim().toLowerCase()));
      const activeWholeExclusions = profile.excludedWholeChapters.filter(
        (ex) => !selectedNorm.has(ex.trim().toLowerCase()),
      );
      if (activeWholeExclusions.length > 0) {
        lines.push(
          `- EXCLUDED WHOLE CHAPTERS (DO NOT ask any theory questions from): ${activeWholeExclusions.join(', ')}.`,
        );
      }
    }
    profile.excludedTopicsPrompt.forEach((rule) => {
      lines.push(`- EXCLUDE SLO: ${rule}`);
    });
    profile.importantPaperRules.forEach((rule) => {
      lines.push(`- PAPER RULE: ${rule}`);
    });
  }

  return lines.join('\n').slice(0, 2600);
}
