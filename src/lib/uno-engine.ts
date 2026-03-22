
export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four';

export interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
}

export interface Player {
  id: string;
  name: string;
  hand: UnoCard[];
}

export interface GameState {
  roomId: string;
  players: Player[];
  discardPile: UnoCard[];
  drawPile: UnoCard[];
  currentPlayerIndex: number;
  currentColor: CardColor;
  direction: 1 | -1;
  status: 'lobby' | 'playing' | 'ended';
  winner?: string;
  lastAction?: string;
}

export const createDeck = (): UnoCard[] => {
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  const values: CardValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw_two'];
  const deck: UnoCard[] = [];

  colors.forEach((color) => {
    values.forEach((value) => {
      const count = value === '0' ? 1 : 2;
      for (let i = 0; i < count; i++) {
        deck.push({ id: `${color}-${value}-${i}-${Math.random().toString(36).substr(2, 5)}`, color, value });
      }
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}-${Math.random().toString(36).substr(2, 5)}`, color: 'wild', value: 'wild' });
    deck.push({ id: `wild-draw-four-${i}-${Math.random().toString(36).substr(2, 5)}`, color: 'wild', value: 'wild_draw_four' });
  }

  return shuffle(deck);
};

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const canPlayCard = (card: UnoCard, topCard: UnoCard, currentColor: CardColor): boolean => {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
};

export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

export const getInitialGameState = (roomId: string): GameState => {
  const deck = createDeck();
  return {
    roomId,
    players: [],
    discardPile: [],
    drawPile: deck,
    currentPlayerIndex: 0,
    currentColor: 'red',
    direction: 1,
    status: 'lobby'
  };
};
