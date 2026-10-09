// Content Dashboard Configuration

export const BRANDS = ["Oxygrainz", "FlexiGlo", "Multigrainz"] as const;
export type Brand = (typeof BRANDS)[number];

export const CONTENT_TYPES = {
  Video: "VI",
  Picture: "PI",
  Carousel: "CA",
} as const;
export type ContentType = keyof typeof CONTENT_TYPES;

export const LAYERS = ["Layer 1", "Layer 2", "Layer 3"] as const;

export const RANKINGS = {
  // Rules differ per layer — see src/lib/ranking.ts
  A: { label: "【A】", color: "#4a7c59" },
  B: { label: "【B】", color: "#7c6e2f" },
  C: { label: "【C】", color: "#8b5e3c" },
  D: { label: "【D】", color: "#8b3c3c" },
  NIL: { label: "NIL", color: "#666" },
} as const;
export type Ranking = keyof typeof RANKINGS;

export const ANGLES: Record<Brand, string[]> = {
  Oxygrainz: [
    "白发", "脱发", "三高",
    "Testimonial", "Promotion", "Trend", "FAQ", "O2O",
    "走心文案", "Clickbait",
  ],
  FlexiGlo: [
    "膝盖痛｜咔咔响", "坐骨痛｜腰痛｜脚麻痹", "肩膀｜颈椎｜手指｜手麻痹",
    "以上全有", "关节保养｜没症状",
    "Testimonial", "Promotion", "Trend", "FAQ", "O2O",
    "走心文案", "Clickbait",
  ],
  Multigrainz: [
    "DM", "Breast Milk", "High Blood Sugar", "Health", "Unknown", "HB", "孕吐",
    "Testimonial", "Promotion", "Trend", "FAQ",
    "走心文案", "Clickbait",
  ],
};

export type User = {
  id: string;
  username: string;
  name: string;
  role: "master" | "marketer";
  brand?: Brand;
};

// Default users - passwords will be hashed at runtime
export const DEFAULT_USERS: (Omit<User, "id"> & { password: string })[] = [
  { username: "boss", name: "Boss", role: "master", password: "itscoll2026" },
  { username: "kayson", name: "Kayson", role: "marketer", brand: "Oxygrainz", password: "oxy2026" },
  { username: "lucas", name: "Lucas", role: "marketer", brand: "FlexiGlo", password: "fg9908" },
  { username: "eva", name: "Eva", role: "marketer", brand: "Multigrainz", password: "mg9223" },
];
