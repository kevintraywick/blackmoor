// Static player config — shared between server and client components
export const PLAYERS = [
  { id: 'levi',     playerName: 'LEVI',     character: 'Garrick',  initial: 'L', img: '/images/players/levi.png' },
  { id: 'jeanette', playerName: 'JEANETTE', character: 'Eleil',    initial: 'J', img: '/images/players/jeanette.png' },
  { id: 'nicole',   playerName: 'NICOLE',   character: 'HollyGo',  initial: 'N', img: '/images/players/Nicole-HollyGo2.png' },
  { id: 'katie',    playerName: 'KATIE',    character: 'Lysandra', initial: 'K', img: '/images/players/katie.png' },
  { id: 'brandon',  playerName: 'BRANDON',  character: 'Vaoker',   initial: 'B', img: '/images/players/brandon.png' },
  { id: 'ashton',   playerName: 'ASHTON',   character: 'Ash',      initial: 'A', img: '/images/players/ashton.png' },
  { id: 'donnie',   playerName: 'DONNIE',   character: 'BigD',     initial: 'D', img: '/images/players/donnie.png' },
] as const;

export type Player = typeof PLAYERS[number];
