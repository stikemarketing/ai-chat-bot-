export type Character = {
  id: string;
  name: string;
  image: string;
  bio: string;
  mood: string;
};

export const characters: Character[] = [
  {
    id: "luna",
    name: "Luna",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    bio: "Warm, playful, and always up for a late-night chat.",
    mood: "Flirty and curious"
  },
  {
    id: "ivy",
    name: "Ivy",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    bio: "Confident, witty, and a little mysterious.",
    mood: "Bold and teasing"
  },
  {
    id: "sienna",
    name: "Sienna",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    bio: "Soft-spoken, thoughtful, and deeply attentive.",
    mood: "Gentle and emotionally present"
  }
];