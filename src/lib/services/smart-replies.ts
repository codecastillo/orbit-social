/**
 * Smart reply suggestions: client-side heuristic engine.
 * Analyses the last message and returns 3 natural-sounding quick replies.
 */

const GREETING_WORDS = [
  "hi",
  "hey",
  "hello",
  "sup",
  "yo",
  "what's up",
  "whats up",
  "howdy",
  "good morning",
  "good evening",
  "good night",
  "gm",
  "gn",
];

const THANKS_WORDS = [
  "thanks",
  "thank you",
  "thx",
  "ty",
  "appreciate",
  "grateful",
];

const PLAN_WORDS = [
  "plan",
  "hang out",
  "hangout",
  "meet",
  "going",
  "wanna",
  "want to",
  "let's",
  "lets",
  "come",
  "join",
  "party",
  "event",
  "tonight",
  "tomorrow",
  "weekend",
  "trip",
];

const AGREEMENT_WORDS = [
  "right",
  "agree",
  "exactly",
  "true",
  "facts",
  "for real",
  "fr",
  "same",
  "mood",
];

const SAD_WORDS = [
  "sad",
  "upset",
  "bad day",
  "stressed",
  "tired",
  "exhausted",
  "annoyed",
  "frustrated",
  "depressed",
  "anxious",
  "worried",
  "miss you",
];

const EXCITED_WORDS = [
  "excited",
  "amazing",
  "awesome",
  "incredible",
  "can't wait",
  "hyped",
  "pumped",
  "stoked",
  "omg",
  "wow",
  "insane",
  "crazy",
];

const FOOD_WORDS = [
  "eat",
  "food",
  "hungry",
  "dinner",
  "lunch",
  "breakfast",
  "pizza",
  "restaurant",
  "cooking",
  "cook",
];

const LAUGH_WORDS = ["lol", "lmao", "haha", "hehe", "rofl", "😂", "🤣", "😭"];

function lower(msg: string): string {
  return msg.toLowerCase().trim();
}

function containsAny(text: string, words: string[]): boolean {
  const t = lower(text);
  return words.some((w) => t.includes(w));
}

function isQuestion(msg: string): boolean {
  const t = msg.trim();
  if (t.endsWith("?")) return true;
  const l = lower(t);
  return /^(do|does|did|is|are|was|were|will|would|could|should|can|have|has|had|what|where|when|why|how|who|which)\b/.test(
    l
  );
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateSmartReplies(lastMessage: string): string[] {
  if (!lastMessage || lastMessage.trim().length === 0) {
    return [];
  }

  const msg = lastMessage.trim();

  // --- Greeting ---
  if (containsAny(msg, GREETING_WORDS) && msg.length < 30) {
    return pickRandom(
      ["Hey!", "Hi there!", "What's up?", "Hey, how are you?", "Heyy!", "Yo!"],
      3
    );
  }

  // --- Thanks ---
  if (containsAny(msg, THANKS_WORDS)) {
    return pickRandom(
      [
        "You're welcome!",
        "No problem!",
        "Anytime!",
        "Of course!",
        "Happy to help!",
        "Don't mention it!",
      ],
      3
    );
  }

  // --- Laughter ---
  if (containsAny(msg, LAUGH_WORDS) && msg.length < 25) {
    return pickRandom(
      ["😂😂", "Haha right", "I know 😂", "Dead 💀", "Fr 😭", "Lmaooo"],
      3
    );
  }

  // --- Sad / supportive ---
  if (containsAny(msg, SAD_WORDS)) {
    return pickRandom(
      [
        "I'm sorry to hear that",
        "I'm here for you",
        "That sucks, hope it gets better",
        "Sending you good vibes",
        "Want to talk about it?",
        "Hang in there!",
      ],
      3
    );
  }

  // --- Excited ---
  if (containsAny(msg, EXCITED_WORDS)) {
    return pickRandom(
      [
        "That's amazing!",
        "So happy for you!",
        "Let's goooo!",
        "No way, that's awesome!",
        "Love that!",
        "🔥🔥🔥",
      ],
      3
    );
  }

  // --- Plans ---
  if (containsAny(msg, PLAN_WORDS)) {
    return pickRandom(
      [
        "Sounds good!",
        "I'm down!",
        "When?",
        "Count me in!",
        "What time?",
        "Where at?",
        "Let's do it!",
      ],
      3
    );
  }

  // --- Food ---
  if (containsAny(msg, FOOD_WORDS)) {
    return pickRandom(
      [
        "I'm hungry too!",
        "Sounds delicious!",
        "What are you having?",
        "Let's grab something!",
        "Yum!",
        "Good choice!",
      ],
      3
    );
  }

  // --- Question ---
  if (isQuestion(msg)) {
    const l = lower(msg);

    // Yes/no type questions
    if (
      /^(do|does|did|is|are|was|were|will|would|could|should|can|have|has|had)\b/.test(
        l
      )
    ) {
      return pickRandom(
        [
          "Yes!",
          "Yeah, definitely!",
          "No, sorry",
          "I think so!",
          "Hmm, not sure",
          "Let me check",
        ],
        3
      );
    }

    // Open-ended questions
    return pickRandom(
      [
        "Good question!",
        "Hmm, let me think",
        "Not sure honestly",
        "I'll get back to you on that",
        "What do you think?",
        "Hard to say!",
      ],
      3
    );
  }

  // --- Agreement ---
  if (containsAny(msg, AGREEMENT_WORDS) && msg.length < 30) {
    return pickRandom(
      ["100%", "Absolutely", "For real!", "Couldn't agree more", "Facts!", "Fr fr"],
      3
    );
  }

  // --- Short message (< 20 chars) ---
  if (msg.length < 20) {
    return pickRandom(
      [
        "Tell me more",
        "That's cool!",
        "Interesting",
        "Oh nice!",
        "Really?",
        "No way!",
        "Haha",
      ],
      3
    );
  }

  // --- Long message (thoughtful reply) ---
  if (msg.length > 100) {
    return pickRandom(
      [
        "I totally get that",
        "Well said!",
        "That makes sense",
        "I feel you on that",
        "Couldn't have said it better",
        "Thanks for sharing that",
      ],
      3
    );
  }

  // --- Default ---
  return pickRandom(
    ["Sounds good!", "Haha nice", "That's cool!", "Oh for sure", "Love that", "Got it!"],
    3
  );
}
