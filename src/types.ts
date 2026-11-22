import { PUNJAB_SYLLABUS_CHAPTERS } from './data/punjabSyllabus';

export type GradeLevel = '9th' | '10th' | '1st A' | '2nd Year';

export type SubjectName =
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'Math'
  | 'Computer Science'
  | 'English'
  | 'Urdu'
  | 'Islamiat'
  | 'Pakistan Studies'
  | 'General Science'
  | 'General Math'
  | 'Civics'
  | 'Economics'
  | 'Education'
  | 'Islamic Studies'
  | 'History'
  | 'Geography'
  | 'Sociology'
  | 'Psychology'
  | 'Home Economics';

export type UserRole = 'student' | 'teacher' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'paused';
export type ResultMode = 'instant' | 'admin_review';
export type TestAccessMode = 'instant_open' | 'scheduled_window';
export type DifficultyTier = 'Standard' | 'Conceptual' | 'Board Exam';
export type TestDeliveryOverride = 'inherit' | 'instant' | 'admin_review';
export type ExamBoard = 'fbise_nbf' | 'punjab_ptb';

export const EXAM_BOARDS: Array<{
  value: ExamBoard;
  label: string;
  shortLabel: string;
}> = [
  {
    value: 'fbise_nbf',
    label: 'Federal Board (FBISE · National Book Foundation — NBF)',
    shortLabel: 'Federal Board (FBISE / NBF)',
  },
  {
    value: 'punjab_ptb',
    label: 'Punjab Board (BISE · Punjab Textbook Board — PTB / PCTB)',
    shortLabel: 'Punjab Board (PTB / PCTB)',
  },
];

export const BOARD_PRINT_LABELS: Record<ExamBoard, string> = {
  fbise_nbf: 'Federal Board (FBISE) · National Book Foundation (NBF) — Sciences & Arts',
  punjab_ptb: 'Punjab Board (BISE) · Punjab Textbook Board (PTB / PCTB) — Sciences & Arts',
};

export const GRADES: GradeLevel[] = ['9th', '10th', '1st A', '2nd Year'];

export const SUBJECT_GROUPS: Array<{
  label: string;
  subjects: SubjectName[];
}> = [
  {
    label: 'Sciences & Technology',
    subjects: ['Physics', 'Chemistry', 'Biology', 'Math', 'Computer Science'],
  },
  {
    label: 'Compulsory (Science & Arts)',
    subjects: ['English', 'Urdu', 'Islamiat', 'Pakistan Studies'],
  },
  {
    label: 'Arts & Humanities',
    subjects: [
      'General Science',
      'General Math',
      'Civics',
      'Economics',
      'Education',
      'Islamic Studies',
      'History',
      'Geography',
      'Sociology',
      'Psychology',
      'Home Economics',
    ],
  },
];

export const SUBJECTS: SubjectName[] = SUBJECT_GROUPS.flatMap((g) => g.subjects);

export const DIFFICULTIES: DifficultyTier[] = ['Standard', 'Conceptual', 'Board Exam'];

export const CURRICULUM_BOARD_LABEL =
  'Federal Board (FBISE · NBF) & Punjab Board (PTB / PCTB) — Sciences & Arts';

export const GRADE_LABELS: Record<GradeLevel, string> = {
  '9th': '9th Class (SSC-I)',
  '10th': '10th Class (SSC-II)',
  '1st A': '1st A / 11th (HSSC-I)',
  '2nd Year': '2nd Year / 12th (HSSC-II)',
};

// Official National Book Foundation (NBF) / Federal Board (FBISE) Curriculum Chapters (Sciences, Compulsory & Arts)
export const SYLLABUS_CHAPTERS: Record<GradeLevel, Record<SubjectName, string[]>> = {
  '9th': {
    Physics: [
      'Physical Quantities and Measurement',
      'Kinematics',
      'Dynamics',
      'Turning Effect of Forces',
      'Forces and Matter',
      'Work, Energy and Power',
      'Properties of Matter & Thermal Properties',
      'Magnetism',
      'Nature of Science and Physics',
    ],
    Chemistry: [
      'Nature of Science in Chemistry',
      'Matter',
      'Atomic Structure',
      'Periodic Table and Periodicity of Properties',
      'Chemical Bonding',
      'Stoichiometry',
      'Electrochemistry',
      'Energetics',
      'Chemical Equilibrium',
      'Acids, Bases and Salts',
      'Environmental Chemistry - Air',
      'Environmental Chemistry - Water',
      'Organic Chemistry',
      'Hydrocarbons',
      'Biochemistry',
      'Empirical Data Collection and Analysis',
      'Separation Techniques',
      'Qualitative Analysis',
      'Chromatography',
    ],
    Biology: [
      'The Science of Biology',
      'Biodiversity',
      'The Cell',
      'The Cell Cycle',
      'Tissues, Organs and Organ Systems',
      'Molecular Biology',
      'Metabolism',
      'Plant Physiology',
      'Plant Reproduction',
      'Evolution',
    ],
    Math: [
      'Real Numbers',
      'Logarithms',
      'Sets and Functions',
      'Factorization and Algebraic Manipulation',
      'Linear Equations and Inequalities',
      'Trigonometry and Bearing',
      'Coordinate Geometry',
      'Geometry of Straight Lines',
      'Geometry and Polygons',
      'Practical Geometry',
      'Basic Statistics',
    ],
    'Computer Science': [
      'Computer Systems',
      'Computational Thinking & Algorithms',
      'Programming Fundamentals (HTML, CSS & JavaScript)',
      'Data and Analysis',
      'Applications of Computer Science & AI',
      'Impacts of Computing & Cyber Security',
      'Entrepreneurship in Digital Age',
    ],
    English: [
      'Unit 1: Hazrat Muhammad Rasulullah (SAW) – A Mercy for All Creation',
      'Unit 2: The Art of Muslim Women’s Entrepreneurship',
      'Unit 3: Modern World and Age of Digital Globalization',
      'Unit 4: Nothing is Impossible – The Brooklyn Bridge',
      'Unit 5: 5 of Jeff Bezos’ Best Lessons for Success',
      'Unit 6: Say No to Drugs',
      'Unit 7: Mowing (Poem by Robert Frost)',
      'Unit 8: The Eagle (Poem by Alfred Tennyson)',
      'Unit 9: Travel and Tourism',
      'Unit 10: Two Mothers Remembered (Poem)',
      'Unit 11: The Metamorphosis',
      'Unit 12: Good Health and Well-being',
      'Grammar, Comprehension, Figures of Speech & Writing Skills',
    ],
    Urdu: [
      'حمد (نظم)',
      'نعت (نظم)',
      'ہجرتِ نبوی (صلی اللہ علیہ وآلہ وسلم)',
      'مرزا غالب کے عادات و خصائل',
      'کاہلی (سر سید احمد خان)',
      'شاعروں کے لطیفے',
      'نصوح اور سلیم کی گفتگو',
      'پنچائیت (منشی پریم چند)',
      'آرام و سکون',
      'قدرِ ایاز',
      'برسات کی بہاریں / پیوستہ رہ شجر سے',
      'اردو قواعد، محاورات، مترادفات و متضادات',
    ],
    Islamiat: [
      'القرآن الکریم (تعارف، حفاظت و فضائل)',
      'عقیدۂ توحید و رسالت',
      'ملائکہ، کتبِ سماویہ اور آخرت',
      'نماز اور روزہ کی اہمیت و مسائل',
      'فتح مکہ اور غزوۂ حنین',
      'اخلاق و آداب (امانت و دیانت، شکر و قناعت)',
      'عہدِ نبوی کے مشاہیرِ اسلام',
    ],
    'Pakistan Studies': [
      'Ideological Basis of Pakistan',
      'Making of Pakistan (1857–1947)',
      'Land and Environment of Pakistan',
      'History of Pakistan (1947–1971)',
      'Constitutional Development in Pakistan',
    ],
    'General Science': [
      'Introduction and Role of Science',
      'Our Life and Chemistry',
      'Biochemistry and Biotechnology',
      'Human Health and Diseases',
      'Diseases: Cause and Prevention',
      'Environment and Natural Resources',
    ],
    'General Math': [
      'Percentage, Ratio and Proportion',
      'Zakat, Ushr and Inheritance',
      'Business Mathematics (Profit, Loss & Discount)',
      'Financial Mathematics (Banking & Insurance)',
      'Consumer Mathematics (Taxes & Utility Bills)',
      'Exponents and Logarithms',
      'Arithmetic and Geometric Sequences',
      'Sets and Functions',
      'Linear Graphs',
      'Basic Statistics',
    ],
    Civics: [
      'Introduction to Civics & Its Scope',
      'Individual and Society',
      'State and Its Elements',
      'Sovereignty & Government',
      'Citizenship: Rights and Duties',
      'Law, Liberty and Equality',
    ],
    Economics: [
      'Nature and Scope of Economics',
      'Basic Economic Concepts (Utility, Goods & Wealth)',
      'Demand and Law of Demand',
      'Supply and Market Equilibrium',
      'Production and Factors of Production',
      'National Income Concepts',
    ],
    Education: [
      'Meaning, Scope and Elements of Education',
      'Aims and Objectives of Education',
      'Foundations of Education (Islamic & Philosophical)',
      'Human Growth and Development',
      'Learning Process & Methods',
      'Guidance and Counseling in Schools',
    ],
    'Islamic Studies': [
      'Quranic Studies & Tafseer Principles',
      'Hadith Nabawi: Compilation and Classification',
      'Fiqh and Sources of Islamic Law',
      'Economic System of Islam',
      'Political and Social System of Islam',
    ],
    History: [
      'Ancient Civilizations & Early South Asia',
      'Advent of Islam in the Subcontinent',
      'Delhi Sultanate',
      'Mughal Empire (Foundation to Decline)',
      'Muslim Reform Movements (Shah Waliullah to Sir Syed)',
    ],
    Geography: [
      'Introduction to Geography & Maps',
      'Earth as a Planet & Motions',
      'Rocks and Minerals',
      'Landforms & Agents of Erosion',
      'Atmosphere, Weather and Climate',
      'Major Climatic Regions',
    ],
    Sociology: [
      'Introduction to Sociology',
      'Individual, Culture and Society',
      'Social Groups and Socialization',
      'Social Norms, Values and Institutions',
      'Social Control and Social Change',
    ],
    Psychology: [
      'Nature, Scope and Methods of Psychology',
      'Biological Basis of Behavior',
      'Sensation and Perception',
      'Learning and Memory',
      'Motivation and Emotion',
    ],
    'Home Economics': [
      'Introduction to Home Economics',
      'Food and Nutrition',
      'Meal Planning and Preservation',
      'Textiles and Clothing',
      'Home Management and Interior Decoration',
      'Child Care and Development',
    ],
  },
  '10th': {
    Physics: [
      'Heat Capacity and Modes of Heat Transfer',
      'Thermal Expansion and Change of State',
      'Waves and Simple Harmonic Motion',
      'Sound',
      'Geometrical Optics',
      'Electrostatics',
      'Current Electricity',
      'Electromagnetism',
      'Basic Electronics & ICT',
      'Atomic and Nuclear Physics',
    ],
    Chemistry: [
      'History of Chemistry & Matter',
      'Stoichiometry',
      'Electrochemistry',
      'Reaction Kinetics',
      'Chemical Equilibrium',
      'Acids, Bases and Salts',
      'Nitrogen, Sulphur and Metals',
      'Organic Chemistry',
      'Hydrocarbons',
      'Hydroxy & Carboxylic Compounds',
      'Polymers & Biochemistry',
      'Environmental Chemistry (Atmosphere & Water)',
      'Chemical Industries',
    ],
    Biology: [
      'Digestive System',
      'Circulatory System',
      'Respiratory System',
      'Urinary System & Homeostasis',
      'Nervous System & Coordination',
      'Support and Movement',
      'Reproduction',
      'Inheritance & Genetics',
      'Biotechnology',
      'Man and His Environment',
      'Pharmacology & Diseases',
    ],
    Math: [
      'Complex Numbers',
      'Quadratic Equations',
      'Matrices and Determinants',
      'Linear and Quadratic Inequalities',
      'Algebraic Functions',
      'Functions and Graphs',
      'Vectors in Plane',
      'Application of Trigonometry',
      'Chords and Arcs of a Circle',
      'Tangent and Angles of a Circle',
      'Practical Geometry of Circles',
      'Basic Statistics',
    ],
    'Computer Science': [
      'Programming in C / Python Fundamentals',
      'Input, Output and Control Structures',
      'Conditional Logic and Loops',
      'Data Structures (Arrays & Lists)',
      'Functions and Modular Programming',
      'Logic Gates & Boolean Algebra',
      'Database Basics & Web Applications',
    ],
    English: [
      'Unit 1: Animal Rights in Islam: Showing Compassion',
      'Unit 2: Cultural Festivals of Pakistan: Unity in Diversity',
      'Unit 3: Media Literacy in the Modern Age',
      'Unit 4: Thank You, Ma’am (Langston Hughes)',
      'Unit 5: Mother Nature (Poem)',
      'Unit 6: How to Make Better Decisions About Your Career',
      'Unit 7: The Alchemist',
      'Unit 8: Blue (Poem)',
      'Unit 9: The Menace of Drugs',
      'Unit 10: Earth and Environment',
      'Unit 11: Adventure Sports',
      'Unit 12: Importance of Life Skills',
      'Grammar, Direct/Indirect Narration & Comprehension',
    ],
    Urdu: [
      'حمد و نعت (نظم)',
      'مرزا محمد سعید',
      'نظریۂ پاکستان',
      'پرستان کی شہزادی',
      'اردو ادب میں عید الفطر',
      'مجھے میرے دوستوں سے بچاؤ',
      'ملمع (حاجرہ مسرور)',
      'چغل خور / نام دیو مالی',
      'علی بخش / استنبول',
      'فاطمہ بنتِ عبداللہ / کسان (نظمیں)',
      'غزلیات (حسرت موہانی، جگر مراد آبادی، فراق)',
      'قواعد، مرکبات، اصنافِ سخن اور محاورات',
    ],
    Islamiat: [
      'سورۃ الاحزاب و سورۃ الممتحنہ (قرآنی احکام)',
      'زکوٰۃ، حج اور جہاد فی سبیل اللہ',
      'غزوۂ تبوک اور حجۃ الوداع',
      'عفت و حیا، صبر و تحمل اور عدل و انصاف',
      'حقوق العباد (والدین، اساتذہ، ہمسایہ)',
      'تدوینِ حدیث و فقہ اسلامی',
    ],
    'Pakistan Studies': [
      'History of Pakistan (1971 to Present)',
      'Foreign Relations of Pakistan',
      'Economic Development of Pakistan',
      'Population, Society and Culture of Pakistan',
      'Protection of Women and Civic Rights',
    ],
    'General Science': [
      'Energy: Forms, Conservation and Renewable Sources',
      'Our Environment & Pollution Control',
      'Current Electricity in Daily Life',
      'Basic Electronics',
      'Science and Technology (Communication & Space)',
      'Atomic Energy and Radiation',
    ],
    'General Math': [
      'Algebraic Formulas and Applications',
      'Factorization',
      'Algebraic Manipulation (HCF, LCM & Fractions)',
      'Linear Equations and Inequalities',
      'Quadratic Equations',
      'Matrices and Determinants',
      'Fundamentals of Geometry',
      'Practical Geometry',
      'Areas and Volumes',
      'Introduction to Coordinate Geometry',
    ],
    Civics: [
      'History of Pakistan Movement & Ideology',
      'Constitutional Framework of Pakistan',
      'Structure of Federal and Provincial Governments',
      'Local Government System',
      'Social Problems of Pakistan & Civic Solutions',
      'Pakistan and the International Community (UN, OIC)',
    ],
    Economics: [
      'Money and Banking',
      'Public Finance, Taxes and Government Budget',
      'International Trade and Balance of Payments',
      'Economic Development & Planning in Pakistan',
      'Agriculture, Industry and Infrastructure of Pakistan',
    ],
    Education: [
      'History of Education in Pakistan',
      'Curriculum Development and Evaluation',
      'Educational Administration and Supervision',
      'Co-Curricular Activities & School Discipline',
      'Educational Problems in Pakistan',
    ],
    'Islamic Studies': [
      'Seerat-un-Nabi (SAW) — Madni Era & Treaties',
      'Khilafat-e-Rashida (Governance & Achievements)',
      'Muslim Thinkers and Scientists',
      'Islamic Culture and Civilization',
      'Contemporary Challenges & Islamic Solutions',
    ],
    History: [
      'Freedom Movement (1857–1947)',
      'Allama Iqbal, Quaid-e-Azam and Pakistan Resolution',
      'Creation of Pakistan and Initial Challenges',
      'Constitutional & Political History of Pakistan',
      'Foreign Policy and National Development',
    ],
    Geography: [
      'Oceans, Tides and Currents',
      'Natural Vegetation and Wildlife',
      'Population Distribution and Settlements',
      'World Agriculture and Mineral Resources',
      'Geography of Pakistan (Physical Features & Economy)',
    ],
    Sociology: [
      'Social Stratification and Mobility',
      'Rural and Urban Communities in Pakistan',
      'Social Problems (Poverty, Illiteracy, Population)',
      'Role of Media and Technology in Society',
      'Community Development Programs',
    ],
    Psychology: [
      'Intelligence and Psychological Testing',
      'Personality Theories and Assessment',
      'Stress, Mental Health and Adjustment',
      'Social Attitudes and Group Behavior',
      'Developmental Psychology Across Lifespan',
    ],
    'Home Economics': [
      'Family Resource Management',
      'Consumer Education and Budgeting',
      'Apparel Construction and Wardrobe Planning',
      'Therapeutic Nutrition and Health',
      'Home Safety and First Aid',
    ],
  },
  '1st A': {
    Physics: [
      'Physical Quantities and Measurement',
      'Vectors',
      'Translatory Motion',
      'Rotational and Circular Motion',
      'Work and Kinetic Energy',
      'Fluid Mechanics',
      'Physics of Solids',
      'Heat and Thermodynamics',
      'Waves',
      'Electrostatics',
      'Electricity',
      'Magnetism',
      'Relativity',
      'Particle Physics',
    ],
    Chemistry: [
      'History of Chemistry',
      'Atomic Structure',
      'Chemical Bonding',
      'Stoichiometry',
      'States and Phases of Matter',
      'Energetics',
      'Chemical Kinetics',
      'Chemical Equilibrium',
      'Acids-Bases Chemistry',
      'Periodic Table',
      'Nitrogen and Sulphur',
      'Halogens',
      'Environmental Chemistry - Air',
      'Environmental Chemistry - Water',
      'Organic Chemistry',
      'Hydrocarbons',
      'Halogenoalkanes',
      'Alcohols',
      'Carbonyl Compounds',
      'Nitrogen Compounds - Amines',
      'Organic Synthesis',
      'Energy',
    ],
    Biology: [
      'Cell Structure and Function',
      'Biological Molecules',
      'Enzymes',
      'Bioenergetics',
      'Acellular Life',
      'Prokaryotes',
      'Protists and Fungi',
      'Diversity Among Plants',
      'Diversity Among Animals',
      'Form and Functions in Plants',
      'Digestion',
      'Circulation',
      'Immunity',
    ],
    Math: [
      'Complex Numbers',
      'Matrices and Determinants',
      'Vectors',
      'Sequences and Series',
      'Polynomials',
      'Permutation and Combination',
      'Mathematical Induction and Binomial Theorem',
      'Fundamentals of Trigonometry',
      'Trigonometric Functions',
    ],
    'Computer Science': [
      'Computer Systems',
      'Computational Thinking and Algorithms',
      'Programming Fundamentals (Python)',
      'Data and Analysis',
      'Application of Computer Science (IoT & Blockchain)',
      'Impacts of Computing',
      'Digital Literacy',
      'Entrepreneurship in Digital Age',
    ],
    English: [
      'Unit 1: Family Values in Pakistan',
      'Unit 2: Shooting Stars (Hal Borland)',
      'Unit 3: The Wind (Poem by R.L. Stevenson)',
      'Unit 4: Butterflies (Roger Dean Kiser)',
      'Unit 5: Clean Water and Sanitation',
      'Unit 6: The Darkling Thrush (Poem by Thomas Hardy)',
      'Unit 7: World Heritage Sites in Pakistan',
      'Unit 8: Social Media: A Blessing or a Curse?',
      'Unit 9: Sunshine After Rain (Poem by Brenda Winders)',
      'Unit 10: The Small Woman (Alan Burgess)',
      'Unit 11: The Three Questions (Leo Tolstoy)',
      'Unit 12: Break, Break, Break (Poem by Alfred Tennyson)',
      'Unit 13: Blow, Blow, Thou Winter Wind (Poem by Shakespeare)',
      'Unit 14: Choice of a Profession',
      'Unit 15: The Ninny (Anton Chekhov)',
      'Unit 16: Fourteen (One-Act Play)',
      'Unit 17: The Last Leaf (O. Henry)',
      'Grammar, Synonyms, Figures of Speech & Precis Writing',
    ],
    Urdu: [
      'حمد و نعت',
      'اخلاقِ حسنہ (سیرت نگاری)',
      'اسوۂ حسنہ (صلی اللہ علیہ وآلہ وسلم)',
      'اپنی مدد آپ (سر سید احمد خان)',
      'نیا قانون (سعادت حسن منٹو)',
      'تاریخ کا کفن',
      'ابو القاسم زہراوی',
      'ادیب کی عزت',
      'اوور کوٹ (غلام عباس)',
      'سفارش (احمد ندیم قاسمی)',
      'مکتوباتِ غالب و مکتوباتِ اقبال',
      'نظمیں (توحید، تسلیم و رضا، مستقبل کی جھلک)',
      'غزلیات (میر تقی میر، آتش، مومن، داغ)',
      'علمِ بیان، علمِ بدیع، تلخیص، مکالمہ اور روداد نویسی',
    ],
    Islamiat: [
      'توحید، رسالت، ملائکہ اور کتبِ سماویہ',
      'عقیدۂ آخرت اور انسانی زندگی پر اس کے اثرات',
      'ارکانِ اسلام (نماز، روزہ، زکوٰۃ، حج، جہاد)',
      'اطاعتِ والدین، حقوقِ زوجین اور حقوقِ پڑوسی',
      'سیرتِ طیبہ: صبر و استقامت، عفو و درگزر اور مساوات',
      'تعارفِ قرآنِ مجید اور تدوینِ حدیث',
    ],
    'Pakistan Studies': [
      'Genesis of the Islamic Republic of Pakistan',
      'Early Problems and Constitutional Foundations',
      'Geography of Pakistan',
      'Steps Towards an Islamic Republic',
      'Administrative Structure of Pakistan',
    ],
    'General Science': [
      'Scientific Method and History of Science',
      'Universe, Solar System and Earth',
      'Matter, Energy and Chemical Reactions',
      'Human Physiology and Nutrition',
      'Environmental Conservation and Ecology',
    ],
    'General Math': [
      'Sets, Relations and Functions',
      'Number Systems and Matrices',
      'Linear and Quadratic Equations',
      'Sequences and Series',
      'Financial Arithmetic (Interest, Annuities & Ratios)',
      'Basic Trigonometry and Mensuration',
      'Statistics and Probability',
    ],
    Civics: [
      'Definition, Scope and Utility of Civics',
      'Society, Community and Association',
      'Origin and Evolution of State',
      'Sovereignty, Law and Liberty',
      'Forms of Government (Democracy, Parliamentary, Presidential)',
      'Citizenship, Rights and Fundamental Duties',
    ],
    Economics: [
      'Nature, Scope and Methodology of Economics',
      'Theory of Consumer Behavior (Utility & Indifference Curves)',
      'Demand, Supply and Elasticity',
      'Theory of Production and Laws of Returns',
      'Cost and Revenue Analysis',
      'Market Structures (Perfect Competition & Monopoly)',
      'Factor Pricing (Rent, Wages, Interest, Profit)',
    ],
    Education: [
      'Concept, Scope and Functions of Education',
      'Philosophical and Islamic Foundations of Education',
      'Psychological Foundations (Growth, Learning, Motivation)',
      'Sociological Foundations of Education',
      'Curriculum, Pedagogy and Evaluation',
    ],
    'Islamic Studies': [
      'Uloom-ul-Quran (Revelation, Compilation & Tafseer)',
      'Uloom-ul-Hadith (Sihah Sitta & Isnad)',
      'Seerat-un-Nabi (SAW) as Educator & Statesman',
      'Islamic Jurisprudence (Quran, Sunnah, Ijma, Qiyas)',
      'Islamic Social & Economic Principles',
    ],
    History: [
      'Islamic History: Pre-Islamic Arabia & Makki Life',
      'Madni Era and Charter of Madinah',
      'Khilafat-e-Rashida (Hazrat Abu Bakr to Hazrat Ali RA)',
      'Umayyad Caliphate',
      'Abbasid Caliphate & Golden Age of Science',
    ],
    Geography: [
      'Physical Geography: Scope and Branches',
      'Lithosphere, Plate Tectonics and Volcanism',
      'Weathering, Mass Wasting and Landforms',
      'Atmosphere, Insolation, Winds and Precipitation',
      'Hydrosphere: Ocean Floor, Salinity and Currents',
    ],
    Sociology: [
      'Sociology as a Scientific Discipline',
      'Culture, Cultural Diversity and Subcultures',
      'Socialization and Personality Development',
      'Social Interaction, Groups and Organizations',
      'Social Institutions (Family, Education, Religion, Economy)',
      'Social Deviance and Social Control',
    ],
    Psychology: [
      'History, Schools and Perspectives of Psychology',
      'Research Methods in Psychology',
      'Nervous System, Brain and Endocrine Glands',
      'Sensation, Attention and Perception',
      'Learning Theories (Classical, Operant, Observational)',
      'Memory, Forgetting and Cognition',
    ],
    'Home Economics': [
      'Nutrients, Balanced Diet and Metabolism',
      'Meal Planning Across Life Stages',
      'Food Hygiene, Spoilage and Preservation',
      'Principles of Design and Elements of Art',
      'Textile Fibers, Weaves and Fabric Selection',
    ],
  },
  '2nd Year': {
    Physics: [
      'Gravitation',
      'Statistical Mechanics and Thermodynamics',
      'Simple Harmonic Motion',
      'Diffraction and Interference',
      'Electric Potential and Capacitor',
      'Alternating Current',
      'Quantum Physics',
      'Nuclear Physics',
      'Cosmology',
      'Earth’s Climate',
      'Medical Imaging',
      'Nature of Science: A Debate',
    ],
    Chemistry: [
      'Periodic Classification of Elements & Periodicity',
      'Theories of Covalent Bonding',
      'Chemical Energetics',
      'Electrochemistry',
      'Reaction Kinetics',
      'Chemical Equilibrium',
      'Ionic Equilibrium',
      'Solution and Colloids',
      'Transition Elements',
      'Group IIIA and Group IVA Elements',
      'Group VA and Group VIA Elements',
      'Group VIIA and Group VIIIA Elements',
      'Chemistry of Hydrocarbons',
      'Alkyl Halides',
      'Alcohols, Phenols, and Ethers',
      'Aldehydes and Ketones',
      'Carboxylic Acids',
      'Amines',
      'Macromolecules',
      'Biochemistry',
      'Environmental Chemistry',
      'Nuclear Chemistry',
      'Common Chemical Industries in Pakistan',
    ],
    Biology: [
      'Digestive System of Man',
      'Blood Circulatory System of Man',
      'Respiratory System of Man',
      'Urinary System of Man',
      'Nervous System of Man',
      'Endocrine System of Man',
      'Skeletal System of Man',
      'Reproduction',
      'Development and Aging',
      'Inheritance',
      'Chromosome and DNA',
      'Evolution',
      'Biotechnology',
      'Man and His Environment',
    ],
    Math: [
      'Graphical Representation of Functions',
      'Further Differentiation',
      'Integration',
      'Differential Equations',
      'Analytical Geometry',
      'Conic Section',
      'Kinematics',
      'Numerical Methods',
      'Inverse Trigonometric Functions and Their Graphs',
      'Solution of Trigonometric Equations',
      'Vector Valued Functions and Their Differentiation',
    ],
    'Computer Science': [
      'Computer Systems (HCI & Usability)',
      'Computational Thinking',
      'Programming Fundamentals (Python & Databases)',
      'Data and Analysis (Machine Learning)',
      'Applications of Computer Science (IoT, Blockchain, Cloud & Neural Networks)',
      'Impacts of Computing (Ethics, Law & Security)',
    ],
    English: [
      'Unit 1: Lingkuan Gorge (Tu Peng Cheng)',
      'Unit 2: Population Explosion in Pakistan',
      'Unit 3: The Income-Tax Man (Mark Twain)',
      'Unit 4: Rubaiyat of Omar Khayyam (Edward Fitzgerald)',
      'Unit 5: The Blanket (Floyd Dell)',
      'Unit 6: Stay Hungry – Stay Foolish',
      'Unit 7: Tobacco and Your Health (A Report)',
      'Unit 8: The Sea (Poem by James Reeves)',
      'Unit 9: First Year at Harrow (Winston S. Churchill)',
      'Unit 10: There’s a New Planet in Sight (Catherine Clark Fox)',
      'Unit 11: Harvest Hymn (Poem by John Betjeman)',
      'Unit 12: The Kaghan Valley (Tahir Jahangir)',
      'Unit 13: After Twenty Years (O. Henry)',
      'Unit 14: The Solitary Reaper (Poem by William Wordsworth)',
      'Unit 15: The Pearl (John Steinbeck — Novel)',
      'Idioms, Phrasal Verbs, Sentence Correction & Essays',
    ],
    Urdu: [
      'حمد و نعت',
      'مناقبِ عمر بن عبدالعزیز',
      'تشكيلِ پاكستان',
      'نواب محسن الملک',
      'محنت پسند خردمند',
      'اکبری کی حماقتیں',
      'قرطبہ کا قاضی / دستک (افسانہ و ڈراما)',
      'موا صلات کے جدید ذرائع',
      'ہوائی / ایوب عباسی',
      'نظمیں (سراغِ راہ، تغیر، آدمی نامہ، طلوعِ اسلام)',
      'غزلیات (خواجہ میر درد، غالب، اقبال، فیض، ناصر کاظمی)',
      'مطابقت، حروفِ جار و عطف، ضرب الامثال و قواعد',
    ],
    Islamiat: [
      'قرآن مجید کی منتخب آیات (سورۃ البقرہ و سورۃ الحجرات)',
      'منتخب احادیثِ نبویہ (معاشرتی و اخلاقی تعلیمات)',
      'اسلامی نظامِ حیات (سیاسی، معاشی اور عدالتی نظام)',
      'جہاد فی سبیل اللہ اور امنِ عالم',
      'مشاہیرِ اسلام (امام ابو حنیفہ، امام غزالی، شاہ ولی اللہ)',
    ],
    'Pakistan Studies': [
      'Ideology of Pakistan and Two-Nation Theory',
      'History and Consolidation of Pakistan',
      '1973 Constitution and Human Rights',
      'Economic Planning, Agriculture and Industry',
      'Culture, Languages and National Integration',
      'Foreign Policy of Pakistan & Global Organizations',
    ],
    'General Science': [
      'Biotechnology and Genetic Engineering',
      'Information Technology and Telecommunications',
      'Global Climate Change and Sustainability',
      'Health Sciences, Immunity and Nutrition',
      'Industrial Materials and Polymers',
    ],
    'General Math': [
      'Functions, Limits and Continuity',
      'Introduction to Differentiation and Applications',
      'Basic Integration and Area Under Curves',
      'Analytical Geometry of Straight Lines',
      'Linear Programming and Optimization',
      'Correlation, Regression and Index Numbers',
    ],
    Civics: [
      'Ideological Genesis of Pakistan (1857–1947)',
      'Constitutional Evolution (1956, 1962, 1973)',
      'Parliament, Executive and Judiciary in Pakistan',
      'Public Administration and Accountability',
      'National Integration and Social Cohesion',
      'Pakistan’s Foreign Policy & United Nations',
    ],
    Economics: [
      'National Income: Measurement and Circular Flow',
      'Consumption, Saving, Investment and Multiplier',
      'Money, Inflation and Monetary Policy',
      'Banking System and Central Bank (SBP)',
      'Public Finance, Fiscal Policy and Taxation',
      'International Trade and Balance of Payments',
      'Economic Issues and Planning of Pakistan',
    ],
    Education: [
      'Education in Pakistan: Ancient to Pre-Independence',
      'National Education Policies of Pakistan (1947–Present)',
      'Structure of Education (Primary, Secondary, Higher)',
      'Teacher Education and Professional Ethics',
      'Issues in Pakistani Education (Literacy, Quality, Access)',
    ],
    'Islamic Studies': [
      'Quranic Principles of Governance and Justice',
      'Islamic Banking, Zakat and Riba Prohibition',
      'Human Rights in Islam (Last Sermon Analysis)',
      'Science, Philosophy and Muslim Contributions',
      'Modern Ideologies and Islamic Perspective',
    ],
    History: [
      'Muslim Rule in India: Culture & Administration',
      'British Colonial Rule and Constitutional Reforms (1909–1935)',
      'Pakistan Movement (1937–1947)',
      'Post-1947 Political History of Pakistan',
      'Pakistan’s Role in Regional and World Affairs',
    ],
    Geography: [
      'Economic Geography: Primary, Secondary & Tertiary Activities',
      'World Population Growth, Migration and Urbanization',
      'Major Crops, Minerals and Energy Resources of the World',
      'Physical Geography of Pakistan (Mountains, Plains, Rivers)',
      'Agriculture, Irrigation, Industry & Trade of Pakistan',
    ],
    Sociology: [
      'Social Research Methods and Sampling',
      'Social Change, Modernization and Globalization',
      'Social Problems of Pakistan (Unemployment, Crime, Urbanization)',
      'Population Dynamics and Demographic Transition',
      'Social Welfare and NGOs in Pakistan',
    ],
    Psychology: [
      'Intelligence, Creativity and Aptitude',
      'Motivation, Frustration and Conflict',
      'Personality Assessment and Theories',
      'Psychological Disorders and Therapies',
      'Social Psychology (Attitudes, Prejudice, Leadership)',
      'Guidance, Counseling and Applied Psychology',
    ],
    'Home Economics': [
      'Child Development (Physical, Cognitive & Emotional)',
      'Family Dynamics and Parenting',
      'Home Management, Housing and Interior Space',
      'Fashion Design, Pattern Drafting and Garment Care',
      'Community Nutrition and Public Health',
    ],
  },
};

// Punjab Textbook Board (PTB / PCTB / PECTAA) English Chapters (synced with PUNJAB_SYLLABUS_CHAPTERS)
export const PUNJAB_ENGLISH_CHAPTERS: Record<GradeLevel, string[]> = {
  '9th': PUNJAB_SYLLABUS_CHAPTERS['9th'].English,
  '10th': PUNJAB_SYLLABUS_CHAPTERS['10th'].English,
  '1st A': PUNJAB_SYLLABUS_CHAPTERS['1st A'].English,
  '2nd Year': PUNJAB_SYLLABUS_CHAPTERS['2nd Year'].English,
};

export function getSyllabusChapters(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
): string[] {
  if (board === 'punjab_ptb') {
    return PUNJAB_SYLLABUS_CHAPTERS[grade][subject];
  }
  return SYLLABUS_CHAPTERS[grade][subject];
}

export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_TITLE_LENGTH = 160;
export const MAX_NAME_LENGTH = 120;
export const MAX_TOPIC_LENGTH = 500;
export const MAX_IDENTIFIER_LENGTH = 64;

export interface MCQQuestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  topicTag: string;
}

export interface SubjectiveQuestion {
  prompt: string;
  suggestedAnswer: string;
  marks: number;
  topicTag: string;
  orPrompt?: string;
  orSuggestedAnswer?: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  grade: GradeLevel | 'All';
  subject: SubjectName | 'All';
  identifier: string;
  approvedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemSettings {
  resultMode: ResultMode;
  testAccessMode: TestAccessMode;
  allowStudentInstantPractice: boolean;
  allowTeacherPaperCreation?: boolean;
  defaultTimeLimitMinutes: number;
  passingPercentage: number;
  updatedBy: string;
  updatedAt?: unknown;
}

export const EXAM_TYPE_PRESETS = [
  'Monthly Assessment',
  'Weekly Test',
  'First Term Examination',
  'Second Term Examination',
  'Mid-Term Examination',
  'Send-Up Examination',
  'Pre-Board Examination',
  'Annual / Final Examination',
  'Class Quiz / Practice Test',
] as const;

export interface MCQTest {
  id: string;
  title: string;
  board?: ExamBoard;
  schoolName?: string;
  examLabel?: string;
  paperDate?: string;
  grade: GradeLevel;
  subject: SubjectName;
  topic: string;
  difficulty: DifficultyTier;
  durationMinutes: number;
  questionCount: number;
  marksPerQuestion?: number;
  questions: MCQQuestion[];
  shortQuestionCount?: number;
  longQuestionCount?: number;
  shortQuestions?: SubjectiveQuestion[];
  longQuestions?: SubjectiveQuestion[];
  shortChoiceNote?: string;
  longChoiceNote?: string;
  sectionATimeMinutes?: number;
  patternLabel?: string;
  deliveryMode: TestDeliveryOverride;
  isActive: boolean;
  scheduledReleaseAt: string;
  scheduledEndAt?: string;
  allowedGrades?: GradeLevel[];
  createdBy: string;
  createdByName: string;
  createdByRole: 'teacher' | 'admin' | 'student_practice';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  testCreatorId: string;
  grade: GradeLevel;
  subject: SubjectName;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  answers: number[];
  shortAnswers?: string[];
  longAnswers?: string[];
  score: number;
  totalQuestions: number;
  marksPerQuestion?: number;
  obtainedMarks?: number;
  totalMarks?: number;
  percentage: number;
  deliveryModeUsed: ResultMode;
  resultReleased: boolean;
  status: 'submitted' | 'reviewed';
  releasedBy: string;
  autoCancelled?: boolean;
  terminationReason?: string;
  submittedAt?: unknown;
  updatedAt?: unknown;
}
