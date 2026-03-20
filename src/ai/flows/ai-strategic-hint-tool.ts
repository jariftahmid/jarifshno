'use server';
/**
 * @fileOverview This file implements an AI-powered strategic hint tool for an Uno game.
 *
 * - getStrategicHint - A function that provides a strategic suggestion for the optimal card to play.
 * - StrategicHintInput - The input type for the getStrategicHint function.
 * - StrategicHintOutput - The return type for the getStrategicHint function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CardSchema = z.object({
  color: z.string().describe('The color of the card (e.g., "red", "blue", "green", "yellow", "wild").'),
  value: z.string().describe('The value of the card (e.g., "0"-"9", "skip", "reverse", "draw_two", "wild", "wild_draw_four").'),
});
export type Card = z.infer<typeof CardSchema>;

const PlayerInfoSchema = z.object({
  name: z.string().describe('The name of the opponent player.'),
  cardsLeft: z.number().describe('The number of cards left in this opponent\'s hand.'),
});
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;

const StrategicHintInputSchema = z.object({
  playerHand: z.array(CardSchema).describe('The current cards in the player\'s hand.'),
  discardPileTopCard: CardSchema.describe('The top card on the discard pile.'),
  currentColor: z.string().describe('The currently active color in play, especially after a wild card is played.'),
  opponentPlayers: z.array(PlayerInfoSchema).describe('Information about opponent players, including their names and card counts.'),
});
export type StrategicHintInput = z.infer<typeof StrategicHintInputSchema>;

const StrategicHintOutputSchema = z.object({
  suggestedCard: CardSchema.describe('The suggested card to play from the player\'s hand.'),
  reasoning: z.string().describe('An explanation of why this card is the optimal choice.'),
  wildCardColorSuggestion: z.string().optional().describe('If the suggestedCard is a Wild card, this is the color that should be chosen.'),
});
export type StrategicHintOutput = z.infer<typeof StrategicHintOutputSchema>;

export async function getStrategicHint(input: StrategicHintInput): Promise<StrategicHintOutput> {
  return strategicHintFlow(input);
}

const strategicHintPrompt = ai.definePrompt({
  name: 'strategicHintPrompt',
  input: { schema: StrategicHintInputSchema },
  output: { schema: StrategicHintOutputSchema },
  prompt: `You are a Senior Uno Player AI, an expert in Uno strategy. Your goal is to help the player win by suggesting the optimal card to play from their hand, based on the current game state.

Consider the following information:

Player's Hand: {{{json playerHand}}}
Top card on Discard Pile: {{{json discardPileTopCard}}}
Current active color: {{{currentColor}}}
Opponent Players: {{{json opponentPlayers}}}

Rules to consider for optimal play:
- You must match the discard pile card by color OR value. If the top card is a Wild card, you must match the 'currentColor'.
- Wild cards (value 'wild' or 'wild_draw_four') can be played at any time and allow the player to choose the next 'currentColor'.
- Action cards (skip, reverse, draw_two, wild_draw_four) have strategic implications.
- Pay close attention to opponent card counts, especially if an opponent has only one card left.
- Prioritize playing action cards or wild draw four cards on opponents with few cards if possible.
- If you have multiple valid cards, choose the one that gives the player the most strategic advantage (e.g., setting a good color for the next turn, blocking an opponent, getting rid of high-value cards).
- If playing a Wild card, suggest the color that best benefits the player or hinders opponents (e.g., a color the player has many of, or a color an opponent has few of).

Based on the above, identify the single best card to play from the player's hand and provide a detailed reasoning. If a Wild card is suggested, also provide the optimal color to choose.

Only output the JSON object as defined by the output schema.`,
});

const strategicHintFlow = ai.defineFlow(
  {
    name: 'strategicHintFlow',
    inputSchema: StrategicHintInputSchema,
    outputSchema: StrategicHintOutputSchema,
  },
  async (input) => {
    const { output } = await strategicHintPrompt(input);
    if (!output) {
      throw new Error('Failed to get a strategic hint.');
    }
    return output;
  }
);
