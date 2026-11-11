/* Classes, matières et sujets de travail. Les sujets sont des propositions courantes pour chaque classe :
   ce n'est pas le programme officiel mot pour mot. L'élève peut écrire son propre sujet ou coller son cours. */

export const GRADES = [
  { id: 'cp', name: 'CP', cycle: 'Primaire' }, { id: 'ce1', name: 'CE1', cycle: 'Primaire' }, { id: 'ce2', name: 'CE2', cycle: 'Primaire' },
  { id: 'cm1', name: 'CM1', cycle: 'Primaire' }, { id: 'cm2', name: 'CM2', cycle: 'Primaire' },
  { id: '6e', name: '6e', cycle: 'Collège' }, { id: '5e', name: '5e', cycle: 'Collège' }, { id: '4e', name: '4e', cycle: 'Collège' }, { id: '3e', name: '3e', cycle: 'Collège' },
  { id: '2nde', name: '2nde', cycle: 'Lycée' }, { id: '1re', name: '1ère', cycle: 'Lycée' }, { id: 'tle', name: 'Terminale', cycle: 'Lycée' }
];
export const gradeName = id => { const g = GRADES.find(x => x.id === id); return g ? g.name : ''; };
export const gradeLabel = id => { const g = GRADES.find(x => x.id === id); return g ? (g.id === 'tle' ? 'Terminale' : 'classe de ' + g.name) : ''; };

export const SUBJECTS = [
  { id: 'm', name: 'Mathématiques', ic: 'M' },
  { id: 'f', name: 'Français', ic: 'F' },
  { id: 's', name: 'Sciences physiques et SVT', ic: 'S' },
  { id: 'a', name: 'Anglais', ic: 'A' },
  { id: 'h', name: 'Histoire-Géographie', ic: 'H' }
];
export const subjById = id => SUBJECTS.find(s => s.id === id) || null;
export const subjByName = n => SUBJECTS.find(s => s.name === n) || null;

/* Chaque sujet : 'Titre', ou ['Titre', identifiant historique, générateur local]. */
const C = {
  cp: {
    m: [['Les nombres jusqu’à 100'], ['Additionner', 0, 'add'], ['Soustraire', 0, 'sub'], ['Les formes'], ['Mesurer des longueurs']],
    f: ['Les sons et les lettres', 'Lire des syllabes', 'Lire des mots', 'Écrire des phrases simples', 'L’ordre alphabétique'],
    s: ['Le corps humain', 'Les cinq sens', 'Les animaux', 'Les plantes', 'L’eau'],
    h: ['Ma famille', 'Mon école', 'Mon quartier et mon village', 'Les jours et les mois']
  },
  ce1: {
    m: ['Les nombres jusqu’à 1 000', ['Addition posée', 0, 'add'], ['Soustraction posée', 0, 'sub'], ['Tables de multiplication', 0, 'mul'], 'Mesures de longueur', 'Problèmes simples'],
    f: ['Lire un texte court', 'Le nom et l’article', 'Le verbe et le sujet', 'Le présent des verbes du 1er groupe', 'La phrase (majuscule et point)', 'Dictée de mots'],
    s: ['L’alimentation et l’hygiène', 'Les êtres vivants', 'L’eau et ses états', 'Les saisons', 'Les objets et leurs usages'],
    h: ['Hier, aujourd’hui, demain', 'L’école et la commune', 'Les métiers', 'Se repérer sur un plan', 'Le Bénin, mon pays']
  },
  ce2: {
    m: ['Les nombres jusqu’à 10 000', ['Multiplication posée', 0, 'mul'], ['La division simple', 0, 'div'], 'Les fractions simples', 'Mesures de masse et de capacité', 'Le périmètre'],
    f: ['Le groupe nominal', 'Passé, présent, futur', 'L’accord du sujet et du verbe', 'Les homophones (a/à, et/est)', 'Synonymes et contraires', 'Écrire des phrases'],
    s: ['L’alimentation et la santé', 'Les animaux et leur milieu', 'Les plantes', 'L’air et l’eau', 'Les états de la matière'],
    h: ['Les repères du temps', 'La région où j’habite', 'Les villes et les villages du Bénin', 'Les cartes et les plans']
  },
  cm1: {
    m: ['Les grands nombres', ['Les quatre opérations', 0, 'ops'], 'La division euclidienne', 'Les fractions', 'Les nombres décimaux', 'Aires et périmètres', 'Proportionnalité'],
    f: ['Sujet, verbe et compléments', 'Passé composé et imparfait', 'Les accords dans le groupe nominal', 'Les homophones', 'Lire et comprendre un texte', 'Le vocabulaire'],
    s: ['La respiration', 'Le cycle de l’eau', 'Les plantes et la germination', 'Les états de la matière', 'L’électricité simple'],
    h: ['Les royaumes du Dahomey', 'Le relief et le climat du Bénin', 'L’Afrique de l’Ouest', 'Lire une carte'],
    a: ['Salutations et présentations', 'Les nombres et les couleurs', 'Ma famille et mon école']
  },
  cm2: {
    m: ['Opérations sur les décimaux', 'Les fractions', 'Proportionnalité et pourcentages', 'Aires et volumes', 'Les angles et les triangles', 'Problèmes'],
    f: ['Conjugaison : présent, futur, passé composé', 'Les compléments du verbe', 'La phrase simple et la phrase complexe', 'L’accord du participe passé', 'Orthographe d’usage', 'Production d’écrit'],
    s: ['Le corps humain', 'La reproduction des plantes', 'La Terre et le Soleil', 'Les énergies', 'L’environnement et l’hygiène'],
    h: ['L’indépendance du Dahomey (1960)', 'Le Bénin et ses départements', 'L’Afrique : relief et climats', 'Continents et océans'],
    a: ['Phrases simples (I am, I have)', 'Les jours et les mois', 'Ma journée']
  },
  '6e': {
    m: ['Les nombres décimaux', 'Opérations sur les décimaux', 'Les fractions', 'Proportionnalité', 'Droites, segments et angles', 'Périmètres et aires'],
    f: ['Nature et fonction des mots', 'Le groupe nominal', 'Présent, imparfait et passé simple', 'Le récit', 'Orthographe grammaticale', 'Le vocabulaire'],
    s: ['Les états de la matière', 'Les mélanges', 'Le milieu de vie des êtres vivants', 'Les caractéristiques des animaux', 'La respiration'],
    h: ['Se repérer dans le temps et l’espace', 'Les premières sociétés', 'L’Égypte ancienne', 'Le relief et le climat', 'Le Bénin : localisation et départements'],
    a: ['Greetings and presentations', 'Le verbe to be et to have', 'Numbers, days and months', 'The family', 'Le présent simple']
  },
  '5e': {
    m: ['Les nombres relatifs', 'Les fractions', 'Initiation au calcul littéral', 'Proportionnalité', 'Les triangles', 'Les parallélogrammes', 'Statistiques : la moyenne'],
    f: ['Les classes grammaticales', 'Les fonctions dans la phrase', 'Les temps du passé', 'Le texte narratif', 'Le texte descriptif', 'Orthographe'],
    s: ['Les mélanges et la solubilité', 'L’air', 'Le circuit électrique simple', 'La nutrition des plantes', 'La digestion', 'La reproduction'],
    h: ['Les grands empires d’Afrique de l’Ouest', 'Les royaumes de l’ancien Dahomey', 'Les climats et les milieux du monde', 'La population mondiale'],
    a: ['Présent simple et présent continu', 'Le prétérit des verbes réguliers', 'Les prépositions de lieu', 'Décrire une personne et un lieu']
  },
  '4e': {
    m: ['Les nombres relatifs : opérations', 'Les puissances', ['Calcul littéral : développer et réduire', 0, 'calc'], ['Équations du premier degré', 0, 'eq'], ['Théorème de Pythagore', 0, 'pyth'], 'Théorème de Thalès', 'Statistiques'],
    f: ['Les propositions', 'Subjonctif et conditionnel', 'Le discours rapporté', 'Le texte argumentatif', 'Les figures de style', 'Orthographe'],
    s: ['Tension et intensité électriques', 'Les atomes et les molécules', 'La lumière', 'La digestion et la nutrition', 'La reproduction humaine'],
    h: ['La traite négrière', 'Les grandes explorations', 'Les révolutions au XVIIIe siècle', 'Les ressources de l’Afrique', 'Les transports et les échanges dans le monde'],
    a: ['Prétérit simple et continu', 'Le futur (will, going to)', 'Comparatifs et superlatifs', 'Les verbes modaux', 'Compréhension de texte']
  },
  '3e': {
    m: [['Équations du premier degré', 'm_eq'], ['Calcul littéral', 'm_calc'], ['Théorème de Pythagore', 'm_pyth'], 'Racines carrées', 'Fonctions linéaires et affines', 'Systèmes d’équations', 'Trigonométrie dans le triangle rectangle', 'Statistiques'],
    f: [['Figures de style', 'f_fig'], ['Conjugaison', 'f_conj'], 'La phrase complexe', 'Le texte argumentatif', 'Le résumé de texte', 'Expression écrite'],
    s: ['Courant électrique et loi d’Ohm', 'Les forces et la gravitation', 'Acides et bases', 'La transmission des caractères héréditaires', 'Les énergies'],
    h: ['La Première Guerre mondiale', 'La Seconde Guerre mondiale', 'La décolonisation et les indépendances', 'Le Bénin depuis l’indépendance', 'CEDEAO et Union africaine'],
    a: ['Le present perfect', 'Les phrases conditionnelles', 'La voix passive', 'Le discours rapporté', 'Compréhension et expression écrite']
  },
  '2nde': {
    m: ['Les ensembles de nombres', 'Calcul algébrique et équations', 'Inéquations', 'Généralités sur les fonctions', 'Statistiques', 'Les vecteurs', 'Géométrie dans l’espace', 'Trigonométrie'],
    f: ['Le roman et le texte narratif', 'Le théâtre', 'La poésie', 'L’étude de texte', 'La phrase complexe', 'Expression écrite'],
    s: ['Forces et équilibre', 'Courant électrique continu', 'Atomes et molécules', 'La mole', 'La cellule', 'La reproduction'],
    h: ['Les grandes civilisations', 'L’Afrique avant la colonisation', 'La révolution industrielle', 'Ressources et développement', 'Les grands ensembles géographiques'],
    a: ['Révision des temps', 'Les phrases conditionnelles', 'La voix passive', 'Rédiger un essai', 'Compréhension de texte']
  },
  '1re': {
    m: ['Le second degré', 'Les suites numériques', 'La dérivation', 'Les probabilités', 'Le produit scalaire', 'Trigonométrie', 'Statistiques'],
    f: ['Le roman', 'Le théâtre', 'La poésie', 'Le commentaire de texte', 'La dissertation', 'L’argumentation'],
    s: ['Mouvement : cinématique et dynamique', 'Travail et énergie', 'Solutions aqueuses et pH', 'L’hérédité', 'L’immunité'],
    h: ['La Première Guerre mondiale', 'Les régimes totalitaires', 'La Seconde Guerre mondiale', 'La guerre froide', 'L’Afrique après les indépendances'],
    a: ['Rédiger un essai', 'Révision de la grammaire', 'Le discours rapporté', 'Compréhension de texte', 'Vocabulaire']
  },
  tle: {
    m: ['Limites et continuité', 'Dérivées', 'Primitives et intégrales', 'Le logarithme népérien', 'La fonction exponentielle', 'Suites numériques', 'Probabilités', 'Nombres complexes'],
    f: ['Le commentaire composé', 'La dissertation littéraire', 'Le résumé et la discussion', 'Le roman africain', 'La poésie', 'Expression écrite'],
    s: ['Électromagnétisme', 'Oscillations', 'Radioactivité', 'Acides et bases', 'Génétique', 'Immunologie'],
    h: ['Le monde depuis 1945', 'La Conférence nationale de 1990 et la démocratie au Bénin', 'La mondialisation', 'Les organisations internationales', 'Le développement durable'],
    a: ['Rédiger un essai', 'Révision de la grammaire', 'Voix passive et discours rapporté', 'Compréhension de texte', 'Vocabulaire : société et technologie']
  }
};

const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
const LEGACY_IC = { m_eq: 'x', m_calc: 'a', m_pyth: '△', f_fig: 'F', f_conj: 'C' };

export const TOPICS = [];
GRADES.forEach(g => SUBJECTS.forEach(s => {
  ((C[g.id] || {})[s.id] || []).forEach(e => {
    const a = Array.isArray(e) ? e : [e];
    TOPICS.push({ id: a[1] || g.id + '_' + s.id + '_' + slug(a[0]), grade: g.id, subj: s.id, subjName: s.name, name: a[0], ic: LEGACY_IC[a[1]] || s.ic, gen: a[2] || null });
  });
}));

export const topicsFor = (grade, subj) => TOPICS.filter(t => t.grade === grade && t.subj === subj);
export const topicsOfGrade = grade => TOPICS.filter(t => t.grade === grade);
export const subjectsFor = grade => SUBJECTS.filter(s => topicsFor(grade, s.id).length);

/* Sujet libre : l'élève écrit son propre sujet. Une seule maîtrise par matière. */
export const freeId = subj => 'libre_' + subj;
const BY_ID = {};
TOPICS.forEach(t => { BY_ID[t.id] = t; });
export function CHN(id) {
  if (BY_ID[id]) return BY_ID[id];
  const m = /^libre_([mfsah])$/.exec(id || '');
  if (m) { const s = subjById(m[1]); return { id, grade: null, subj: m[1], subjName: s.name, name: 'Autre sujet (' + s.name + ')', ic: s.ic, gen: null }; }
  return { id, grade: null, subj: '', subjName: '', name: String(id || ''), ic: '•', gen: null };
}
