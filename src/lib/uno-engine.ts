
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
  hasShoutedUno?: boolean;
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
  turnStartedAt?: number; // Timestamp for timer
}

export const createDeck = (): UnoCard[] => {
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  const actionValues: CardValue[] = ['skip', 'reverse', 'draw_two'];
  const deck: UnoCard[] = [];

  colors.forEach((color) => {
    // One '0' per color
    deck.push({ id: `${color}-0-${Math.random()}`, color, value: '0' });
    
    // Two of each 1-9 and actions
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', ...actionValues].forEach((val) => {
      for (let i = 0; i < 2; i++) {
        deck.push({ 
          id: `${color}-${val}-${i}-${Math.random().toString(36).substring(7)}`, 
          color, 
          value: val as CardValue 
        });
      }
    });
  });

  // Four of each Wild
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}-${Math.random()}`, color: 'wild', value: 'wild' });
    deck.push({ id: `wild4-${i}-${Math.random()}`, color: 'wild', value: 'wild_draw_four' });
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
  return {
    roomId,
    players: [],
    discardPile: [],
    drawPile: [],
    currentPlayerIndex: 0,
    currentColor: 'red',
    direction: 1,
    status: 'lobby'
  };
};
