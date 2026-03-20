# **App Name**: Web Uno Arena

## Core Features:

- Lobby & Room Management: Players can enter a username, create new private rooms, or join existing ones using a 4-letter alphanumeric room code.
- Real-time Game Synchronization: Utilizes Socket.io to establish real-time connections, ensuring synchronous game state, player actions, and communication for 2-4 players.
- Interactive Game Board Display: Presents the central discard pile, draw pile, active player's hand (with clickable cards), and opponent indicators showing their remaining card counts.
- Core Uno Game Logic: Implements standard Uno rules, including matching by color or number, action cards (Skip, Reverse, Draw Two), Wild cards (Wild, Wild Draw Four), and a turn-based system.
- Player Hand Interactions: Player cards in hand fan out and lift with a hover effect, and are clickable to initiate a play, enhancing the 'real game' feel.
- In-Game Chat System: A persistent chat box located on the side of the game screen allowing players in the same room to send and receive messages in real-time.
- AI Strategic Hint Tool: An AI-powered tool that provides a strategic suggestion for the optimal card to play from the active player's hand based on current game conditions.

## Style Guidelines:

- The visual theme is a dark mode glassmorphism with a primary focus on deep purples and blues, creating an immersive, modern arena-like experience. The primary color, chosen for interactive elements and highlights, is a vibrant purple (#D34CDB), evoking dynamism and engagement against a dark backdrop. The background features a very dark, subtly tinted purple (#1A161E), suggesting a cosmic depth for the animated mesh gradient. An accent color, a vivid violet (#C896FF), complements the primary with a brighter, more saturated hue, drawing attention to critical UI elements and interactive feedback.
- Headlines and game UI text will use 'Space Grotesk', a proportional sans-serif, for a modern, techy aesthetic. Body text and in-game chat will utilize 'Inter', a grotesque-style sans-serif, chosen for its objective neutrality and excellent readability in blocks of text.
- Player avatars are displayed with circular, glowing borders. The active player's border pulses with a 'Golden Glow' to clearly indicate their turn. A 'Current Color' indicator glows as an aura around the entire game board, providing immediate game state information.
- The game's 'arena' features the draw and discard piles slightly angled in 3D space, positioned at the center stage. The player's hand is prominently displayed at the bottom of the screen. Opponent indicators (names and card counts) are arranged around the central game area. A semi-transparent sidebar with a blur effect ($backdrop-filter: blur(10px)$) is reserved for the chat functionality, positioned adjacent to the main gameplay.
- Background features a subtle, animated mesh gradient ($transform: rotateX(20deg)$) in deep purples and blues. Player cards in hand 'fan out' and lift upward on hover. When the game starts, cards smoothly 'fly' from the deck to each player's hand. Played cards will 'slide and rotate' onto the discard pile. Chat messages will 'pop' in with a fade-in-up animation.