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
  id?: string;
  roomId: string;
  hostId: string;
  players: Player[];
  playerIds: string[];
  discardPile: UnoCard[];
  drawPile: UnoCard[];
  currentPlayerIndex: number;
  currentColor: CardColor;
  direction: 1 | -1;
  status: 'lobby' | 'playing' | 'ended';
  roomType: 'private' | 'random_match';
  winner?: string | null;
  lastAction?: string;
  turnStartedAt?: number;
  createdAt: number;
  countdownEndsAt?: number;
}

export const createDeck = (): UnoCard[] => {
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  const actionValues: CardValue[] = ['skip', 'reverse', 'draw_two'];
  const deck: UnoCard[] = [];

  colors.forEach((color) => {
    deck.push({ id: `${color}-0-${Math.random()}`, color, value: '0' });
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

export const getInitialGameState = (roomId: string, hostId: string, type: 'private' | 'random_match' = 'private'): GameState => {
  return {
    roomId,
    hostId,
    players: [],
    playerIds: [],
    discardPile: [],
    drawPile: [],
    currentPlayerIndex: 0,
    currentColor: 'red',
    direction: 1,
    status: 'lobby',
    roomType: type,
    createdAt: Date.now()
  };
};

export const calculateWinPoints = (opponentHands: UnoCard[][]): number => {
  let points = 0;
  opponentHands.forEach(hand => {
    hand.forEach(card => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(card.value)) {
        points += parseInt(card.value);
      } else if (['skip', 'reverse', 'draw_two'].includes(card.value)) {
        points += 20;
      } else if (['wild', 'wild_draw_four'].includes(card.value)) {
        points += 50;
      }
    });
  });
  return points;
};
