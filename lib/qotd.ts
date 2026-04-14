// Curated Quote of the Day list for The Raven Post broadsheet.
// Mix of fantasy-canon authors the World AI wasn't going to improve on.
// No modern authors; ≤30 words each. Expand freely.

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  // Tolkien
  { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
  { text: 'All we have to decide is what to do with the time that is given us.', author: 'J.R.R. Tolkien' },
  { text: 'Still round the corner there may wait, a new road or a secret gate.', author: 'J.R.R. Tolkien' },
  { text: 'Even the smallest person can change the course of the future.', author: 'J.R.R. Tolkien' },
  { text: 'Faithless is he that says farewell when the road darkens.', author: 'J.R.R. Tolkien' },
  { text: 'The world is indeed full of peril, and in it there are many dark places.', author: 'J.R.R. Tolkien' },
  { text: 'It does not do to leave a live dragon out of your calculations.', author: 'J.R.R. Tolkien' },
  { text: 'Home is behind, the world ahead.', author: 'J.R.R. Tolkien' },

  // Poe
  { text: 'All that we see or seem is but a dream within a dream.', author: 'Edgar Allan Poe' },
  { text: 'Those who dream by day are cognizant of many things which escape those who dream only by night.', author: 'Edgar Allan Poe' },
  { text: 'Believe nothing you hear, and only one half that you see.', author: 'Edgar Allan Poe' },
  { text: 'Deep into that darkness peering, long I stood there, wondering, fearing.', author: 'Edgar Allan Poe' },

  // Lovecraft
  { text: 'That is not dead which can eternal lie, and with strange aeons even death may die.', author: 'H.P. Lovecraft' },
  { text: 'The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.', author: 'H.P. Lovecraft' },
  { text: 'We live on a placid island of ignorance in the midst of black seas of infinity.', author: 'H.P. Lovecraft' },

  // Shakespeare
  { text: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.', author: 'William Shakespeare' },
  { text: 'By the pricking of my thumbs, something wicked this way comes.', author: 'William Shakespeare' },
  { text: 'Lord, what fools these mortals be.', author: 'William Shakespeare' },
  { text: 'Double, double toil and trouble; fire burn and cauldron bubble.', author: 'William Shakespeare' },
  { text: 'We are such stuff as dreams are made on.', author: 'William Shakespeare' },

  // Robert E. Howard (Conan)
  { text: 'Civilized men are more discourteous than savages because they know they can be impolite without having their skulls split.', author: 'Robert E. Howard' },
  { text: 'Know, oh prince, that between the years when the oceans drank Atlantis... there was an age undreamed of.', author: 'Robert E. Howard' },
  { text: 'I live, I burn with life, I love, I slay, and am content.', author: 'Robert E. Howard' },

  // Fritz Leiber (Fafhrd & Grey Mouser)
  { text: 'A pox on all gods and gold, brother. Both make beggars of honest swords.', author: 'Fritz Leiber' },
  { text: 'There is no peace in a world of many and all of them meddlesome.', author: 'Fritz Leiber' },

  // Ursula K. Le Guin (Earthsea)
  { text: 'To hear, one must be silent.', author: 'Ursula K. Le Guin' },
  { text: 'A wizard of power is one who knows the true names of things.', author: 'Ursula K. Le Guin' },
  { text: 'The wise needn\u2019t ask; the fool asks in vain.', author: 'Ursula K. Le Guin' },

  // Mervyn Peake (Gormenghast)
  { text: 'Titus is seven. His confines, Gormenghast. Suckled on shadows, weaned on bone.', author: 'Mervyn Peake' },

  // Lord Dunsany
  { text: 'A man is a very small thing, and the night is very large and full of wonders.', author: 'Lord Dunsany' },
  { text: 'Logic is a poor guide compared with custom.', author: 'Lord Dunsany' },

  // Proverbs / invented Realms flavor
  { text: 'A coin in the palm is worth three in the bard\u2019s song.', author: 'Old Realms Proverb' },
  { text: 'Wolves do not lose sleep over the opinions of sheep — nor sheep over the plans of wolves.', author: 'Old Realms Proverb' },
  { text: 'Trust the priest with your coin, the thief with your secrets, and neither with your wife.', author: 'Old Realms Proverb' },
  { text: 'When the crow calls thrice at dusk, close the shutters.', author: 'Hedge-witch saying' },
  { text: 'Every castle has three gates: the gate of iron, the gate of gold, and the gate of a loose tongue.', author: 'Old Realms Proverb' },
  { text: 'A blade without a scabbard is a quarrel waiting for its reason.', author: 'Old Realms Proverb' },
  { text: 'The mountain does not bargain. It only takes.', author: 'Dwarven saying' },
  { text: 'What the moon shows, the moon may yet hide.', author: 'Elven saying' },
  { text: 'A full moon, a sharpened knife, and a loose oath — one of these will turn before morning.', author: 'Old Realms Proverb' },
  { text: 'Never trust a man who swears by a god you have never heard of.', author: 'Old Realms Proverb' },
];

export function pickRandomQotd(excludeText?: string): Quote {
  const pool = excludeText ? QUOTES.filter(q => q.text !== excludeText) : QUOTES;
  return pool[Math.floor(Math.random() * pool.length)];
}
