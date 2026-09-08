export type Character = {
  id: string;
  name: string;
  age: number;
  image: string;
  bio: string;
  mood: string;
};

export const characters: Character[] = [
  {
    id: "luna",
    name: "Luna",
    age: 27,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    bio: "Warm, playful, and always up for a late-night chat.",
    mood: "Flirty and curious"
  },
  {
    id: "ivy",
    name: "Ivy",
    age: 22,
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    bio: "Confident, witty, and a little mysterious.",
    mood: "Bold and teasing"
  },
  {
    id: "sienna",
    name: "Sienna",
    age: 20,
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    bio: "Warm, thoughtful, and always ready with grounded advice.",
    mood: "Caring and confidently bold"
  }
];
