export interface WordItem {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language?: 'en' | 'hi' | 'es';
  aliases?: string[];
}

export const WORD_BANK: WordItem[] = [
  // ================= ENGLISH (EN) =================
  // Animals
  { word: 'cat', category: 'animals', difficulty: 'easy', language: 'en', aliases: ['kitten'] },
  { word: 'dog', category: 'animals', difficulty: 'easy', language: 'en', aliases: ['puppy'] },
  { word: 'lion', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'tiger', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'bear', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'fox', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'owl', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'wolf', category: 'animals', difficulty: 'easy', language: 'en' },
  { word: 'elephant', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'giraffe', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'monkey', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'dolphin', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'penguin', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'kangaroo', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'zebra', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'rabbit', category: 'animals', difficulty: 'medium', language: 'en', aliases: ['bunny'] },
  { word: 'panda', category: 'animals', difficulty: 'medium', language: 'en' },
  { word: 'octopus', category: 'animals', difficulty: 'hard', language: 'en' },
  { word: 'koala', category: 'animals', difficulty: 'hard', language: 'en' },
  { word: 'chameleon', category: 'animals', difficulty: 'hard', language: 'en' },

  // Food
  { word: 'pizza', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'burger', category: 'food', difficulty: 'easy', language: 'en', aliases: ['hamburger'] },
  { word: 'apple', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'banana', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'bread', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'cake', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'cookie', category: 'food', difficulty: 'easy', language: 'en', aliases: ['biscuit'] },
  { word: 'taco', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'sushi', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'pancake', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'donut', category: 'food', difficulty: 'medium', language: 'en', aliases: ['doughnut'] },
  { word: 'sandwich', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'popcorn', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'chocolate', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'watermelon', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'strawberry', category: 'food', difficulty: 'medium', language: 'en' },
  { word: 'spaghetti', category: 'food', difficulty: 'hard', language: 'en', aliases: ['pasta'] },
  { word: 'croissant', category: 'food', difficulty: 'hard', language: 'en' },
  { word: 'burrito', category: 'food', difficulty: 'hard', language: 'en' },
  { word: 'avocado', category: 'food', difficulty: 'hard', language: 'en' },

  // Objects
  { word: 'book', category: 'objects', difficulty: 'easy', language: 'en' },
  { word: 'chair', category: 'objects', difficulty: 'easy', language: 'en' },
  { word: 'clock', category: 'objects', difficulty: 'easy', language: 'en', aliases: ['watch'] },
  { word: 'pencil', category: 'objects', difficulty: 'easy', language: 'en', aliases: ['pen'] },
  { word: 'keys', category: 'objects', difficulty: 'easy', language: 'en', aliases: ['key'] },
  { word: 'lamp', category: 'objects', difficulty: 'easy', language: 'en' },
  { word: 'guitar', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'camera', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'bicycle', category: 'objects', difficulty: 'medium', language: 'en', aliases: ['bike'] },
  { word: 'umbrella', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'backpack', category: 'objects', difficulty: 'medium', language: 'en', aliases: ['bag'] },
  { word: 'glasses', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'laptop', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'candle', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'scissors', category: 'objects', difficulty: 'medium', language: 'en' },
  { word: 'telescope', category: 'objects', difficulty: 'hard', language: 'en' },
  { word: 'microscope', category: 'objects', difficulty: 'hard', language: 'en' },
  { word: 'hourglass', category: 'objects', difficulty: 'hard', language: 'en' },
  { word: 'parachute', category: 'objects', difficulty: 'hard', language: 'en' },

  // Nature
  { word: 'tree', category: 'nature', difficulty: 'easy', language: 'en' },
  { word: 'flower', category: 'nature', difficulty: 'easy', language: 'en' },
  { word: 'cloud', category: 'nature', difficulty: 'easy', language: 'en' },
  { word: 'beach', category: 'nature', difficulty: 'easy', language: 'en' },
  { word: 'mountain', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'ocean', category: 'nature', difficulty: 'medium', language: 'en', aliases: ['sea'] },
  { word: 'rainbow', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'forest', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'island', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'river', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'sunset', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'volcano', category: 'nature', difficulty: 'hard', language: 'en' },
  { word: 'waterfall', category: 'nature', difficulty: 'hard', language: 'en' },
  { word: 'iceberg', category: 'nature', difficulty: 'hard', language: 'en' },
  { word: 'tornado', category: 'nature', difficulty: 'hard', language: 'en' },

  // Technology & Compound Phrases (Great for Combination mode)
  { word: 'fire truck', category: 'vehicles', difficulty: 'medium', language: 'en' },
  { word: 'ice cream', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'hot dog', category: 'food', difficulty: 'easy', language: 'en' },
  { word: 'tree house', category: 'nature', difficulty: 'medium', language: 'en' },
  { word: 'robot', category: 'technology', difficulty: 'easy', language: 'en' },
  { word: 'rocket', category: 'technology', difficulty: 'easy', language: 'en' },

  // ================= HINDI (HI) =================
  // जानवर (Animals)
  { word: 'बिल्ली', category: 'animals', difficulty: 'easy', language: 'hi', aliases: ['billi', 'cat'] },
  { word: 'कुत्ता', category: 'animals', difficulty: 'easy', language: 'hi', aliases: ['kutta', 'dog'] },
  { word: 'शेर', category: 'animals', difficulty: 'easy', language: 'hi', aliases: ['sher', 'lion'] },
  { word: 'हाथी', category: 'animals', difficulty: 'medium', language: 'hi', aliases: ['haathi', 'elephant'] },
  { word: 'घोड़ा', category: 'animals', difficulty: 'medium', language: 'hi', aliases: ['ghoda', 'horse'] },
  { word: 'भालू', category: 'animals', difficulty: 'medium', language: 'hi', aliases: ['bhaalu', 'bear'] },
  { word: 'मोर', category: 'animals', difficulty: 'easy', language: 'hi', aliases: ['mor', 'peacock'] },
  { word: 'बंदर', category: 'animals', difficulty: 'medium', language: 'hi', aliases: ['bandar', 'monkey'] },
  { word: 'मछली', category: 'animals', difficulty: 'easy', language: 'hi', aliases: ['machli', 'fish'] },

  // खाना (Food)
  { word: 'सेब', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['seb', 'apple'] },
  { word: 'आम', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['aam', 'mango'] },
  { word: 'केला', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['kela', 'banana'] },
  { word: 'रोटी', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['roti', 'bread'] },
  { word: 'चाय', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['chai', 'tea'] },
  { word: 'समोसा', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['samosa'] },
  { word: 'दूध', category: 'food', difficulty: 'easy', language: 'hi', aliases: ['doodh', 'milk'] },
  { word: 'लड्डू', category: 'food', difficulty: 'medium', language: 'hi', aliases: ['laddu', 'laddoo'] },

  // वस्तुएं (Objects) & प्रकृति (Nature)
  { word: 'किताब', category: 'objects', difficulty: 'easy', language: 'hi', aliases: ['kitaab', 'book'] },
  { word: 'कलम', category: 'objects', difficulty: 'easy', language: 'hi', aliases: ['kalam', 'pen'] },
  { word: 'सूरज', category: 'nature', difficulty: 'easy', language: 'hi', aliases: ['suraj', 'sun'] },
  { word: 'चाँद', category: 'nature', difficulty: 'easy', language: 'hi', aliases: ['chand', 'moon'] },
  { word: 'पेड़', category: 'nature', difficulty: 'easy', language: 'hi', aliases: ['ped', 'tree'] },
  { word: 'फूल', category: 'nature', difficulty: 'easy', language: 'hi', aliases: ['phool', 'flower'] },
  { word: 'घर', category: 'objects', difficulty: 'easy', language: 'hi', aliases: ['ghar', 'house'] },
  { word: 'कार', category: 'objects', difficulty: 'easy', language: 'hi', aliases: ['car', 'gaadi'] },
  { word: 'पानी', category: 'nature', difficulty: 'easy', language: 'hi', aliases: ['paani', 'water'] },
  { word: 'तितली', category: 'animals', difficulty: 'medium', language: 'hi', aliases: ['titli', 'butterfly'] },

  // ================= SPANISH (ES) =================
  // Animales (Animals)
  { word: 'gato', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['cat'] },
  { word: 'perro', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['dog'] },
  { word: 'león', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['leon', 'lion'] },
  { word: 'oso', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['bear'] },
  { word: 'lobo', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['wolf'] },
  { word: 'elefante', category: 'animals', difficulty: 'medium', language: 'es', aliases: ['elephant'] },
  { word: 'mono', category: 'animals', difficulty: 'medium', language: 'es', aliases: ['monkey'] },
  { word: 'jirafa', category: 'animals', difficulty: 'medium', language: 'es', aliases: ['giraffe'] },
  { word: 'pájaro', category: 'animals', difficulty: 'easy', language: 'es', aliases: ['pajaro', 'bird'] },
  { word: 'tortuga', category: 'animals', difficulty: 'medium', language: 'es', aliases: ['turtle'] },

  // Comida (Food)
  { word: 'manzana', category: 'food', difficulty: 'easy', language: 'es', aliases: ['apple'] },
  { word: 'plátano', category: 'food', difficulty: 'easy', language: 'es', aliases: ['platano', 'banana'] },
  { word: 'pan', category: 'food', difficulty: 'easy', language: 'es', aliases: ['bread'] },
  { word: 'queso', category: 'food', difficulty: 'easy', language: 'es', aliases: ['cheese'] },
  { word: 'helado', category: 'food', difficulty: 'easy', language: 'es', aliases: ['ice cream'] },
  { word: 'pizza', category: 'food', difficulty: 'easy', language: 'es' },
  { word: 'fresa', category: 'food', difficulty: 'medium', language: 'es', aliases: ['strawberry'] },
  { word: 'café', category: 'food', difficulty: 'easy', language: 'es', aliases: ['cafe', 'coffee'] },

  // Objetos y Naturaleza (Objects & Nature)
  { word: 'libro', category: 'objects', difficulty: 'easy', language: 'es', aliases: ['book'] },
  { word: 'reloj', category: 'objects', difficulty: 'easy', language: 'es', aliases: ['clock', 'watch'] },
  { word: 'casa', category: 'objects', difficulty: 'easy', language: 'es', aliases: ['house'] },
  { word: 'coche', category: 'objects', difficulty: 'easy', language: 'es', aliases: ['car', 'auto'] },
  { word: 'sol', category: 'nature', difficulty: 'easy', language: 'es', aliases: ['sun'] },
  { word: 'luna', category: 'nature', difficulty: 'easy', language: 'es', aliases: ['moon'] },
  { word: 'árbol', category: 'nature', difficulty: 'easy', language: 'es', aliases: ['arbol', 'tree'] },
  { word: 'flor', category: 'nature', difficulty: 'easy', language: 'es', aliases: ['flower'] },
  { word: 'playa', category: 'nature', difficulty: 'easy', language: 'es', aliases: ['beach'] },
  { word: 'estrella', category: 'nature', difficulty: 'medium', language: 'es', aliases: ['star'] },
];
