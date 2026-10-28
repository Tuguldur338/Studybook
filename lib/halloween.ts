export type HalloweenDifficulty = "easy" | "medium" | "hard";

export type HalloweenRiddle = {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  difficulty: HalloweenDifficulty;
};

export const HALLOWEEN_POINTS: Record<HalloweenDifficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

export const HALLOWEEN_DIFFICULTY_LABEL: Record<HalloweenDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

// Ordered so consecutive years get a different question and difficulty.
// 2026 -> index 2, 2027 -> index 3, 2028 -> index 4, and so on.
const RIDDLES: HalloweenRiddle[] = [
  {
    id: "clock-hands",
    question:
      "I have hands but cannot clap. I have a face but cannot smile. What am I?",
    choices: ["A pumpkin", "A ghost", "A clock", "A mirror"],
    answer: 2,
    difficulty: "easy",
  },
  {
    id: "footsteps",
    question: "The more you take, the more you leave behind. What are they?",
    choices: ["Memories", "Footsteps", "Photos", "Candles"],
    answer: 1,
    difficulty: "medium",
  },
  {
    id: "echo",
    question:
      "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    choices: ["An echo", "A shadow", "A dream", "A whisper"],
    answer: 0,
    difficulty: "hard",
  },
  {
    id: "bottle-neck",
    question: "What has a neck but no head?",
    choices: ["A ghost", "A broom", "A candle", "A bottle"],
    answer: 3,
    difficulty: "easy",
  },
  {
    id: "stamp-corner",
    question:
      "What can travel around the world while staying in a corner?",
    choices: ["A shadow", "A moonbeam", "A stamp", "A spider"],
    answer: 2,
    difficulty: "medium",
  },
  {
    id: "cards-heart",
    question: "What has a heart that does not beat?",
    choices: ["A pumpkin", "A deck of cards", "A clock", "A stone"],
    answer: 1,
    difficulty: "hard",
  },
  {
    id: "towel-dries",
    question: "What gets wetter the more it dries?",
    choices: ["A towel", "A sponge", "A ghost", "A raincoat"],
    answer: 0,
    difficulty: "easy",
  },
  {
    id: "future-unseen",
    question:
      "I am always in front of you but can never be seen. What am I?",
    choices: ["The wind", "Your shadow", "A ghost", "The future"],
    answer: 3,
    difficulty: "medium",
  },
];

export function getHalloweenRiddle(year: number): HalloweenRiddle {
  const index = Math.abs(year) % RIDDLES.length;
  return RIDDLES[index];
}

export function isHalloween(date: Date) {
  return date.getMonth() === 9 && date.getDate() === 31;
}
