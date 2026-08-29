export type Preferences = { cities: string[]; loves: string[]; avoids: string[]; budget: string; style: string };
export type Source = { id: string; videoId: string; title: string; creator: string; city: string; duration: string; relevance: string };
export type Evidence = { id: string; sourceId: string; dishId: string; time: string; seconds: number; quote: string; note: string; confidence: number };
export type Dish = { id: string; name: string; chinese: string; pinyin: string; city: string; description: string; match: string; spice: number; price: "$" | "$$"; warning: string; evidenceIds: string[] };

export const SOURCES: Source[] = [
  { id: "chengdu-deep", videoId: "6XRwsnDWWxE", title: "Going deep for spicy street food in Sichuan", creator: "The Food Ranger", city: "Chengdu", duration: "22:18", relevance: "Dan dan noodles and Sichuan street-food context" },
  { id: "chengdu-tour", videoId: "5ZUK59RV5kM", title: "Chinese street food tour in Chengdu", creator: "The Food Ranger", city: "Chengdu", duration: "19:42", relevance: "Local noodle shops and everyday price cues" },
  { id: "xian-street", videoId: "yAmSzzauOF4", title: "I tried Chinese street food in Xi'an", creator: "Hangry By Nature", city: "Xi'an", duration: "18:06", relevance: "Roujiamo and liangpi in one current itinerary" },
  { id: "xian-ten", videoId: "GS_H6Xvbi4c", title: "10-hour Xi'an street-food tour", creator: "Food travel diary", city: "Xi'an", duration: "24:51", relevance: "Biang biang noodles and Muslim Quarter staples" },
  { id: "shanghai-bao", videoId: "3g1ocj_2OiM", title: "Shanghai street food: pan-fried pork buns", creator: "Travel Thirsty", city: "Shanghai", duration: "10:34", relevance: "Close-up evidence for sheng jian bao" },
];

export const EVIDENCE: Evidence[] = [
  { id: "ev-dandan", sourceId: "chengdu-deep", dishId: "dandan", time: "04:12", seconds: 252, quote: "Dan dan noodles are one of the essential street-food stops in Chengdu.", note: "Chilli oil, preserved vegetables, and a strong sesame aroma.", confidence: 94 },
  { id: "ev-mapo", sourceId: "chengdu-tour", dishId: "mapo", time: "12:46", seconds: 766, quote: "The tofu arrives bubbling, with that signature numbing Sichuan pepper.", note: "Restaurant dish, but widely available in casual local shops.", confidence: 89 },
  { id: "ev-liangpi", sourceId: "xian-street", dishId: "liangpi", time: "08:31", seconds: 511, quote: "Liangpi is served cold with chilli oil, garlic, and vinegar.", note: "A refreshing noodle choice that still satisfies a spicy-food preference.", confidence: 97 },
  { id: "ev-roujiamo", sourceId: "xian-street", dishId: "roujiamo", time: "05:18", seconds: 318, quote: "The crisp flatbread is packed with chopped, slow-cooked meat.", note: "Portable, inexpensive, and strongly associated with Xi'an street food.", confidence: 96 },
  { id: "ev-biang", sourceId: "xian-ten", dishId: "biang", time: "13:07", seconds: 787, quote: "The hand-pulled belt noodles are finished with chilli and hot oil.", note: "Excellent match for noodles, spice, and a hands-on street-food experience.", confidence: 92 },
  { id: "ev-shengjian", sourceId: "shanghai-bao", dishId: "shengjian", time: "01:24", seconds: 84, quote: "The buns are pan-fried for a crisp base and steamed so the top stays soft.", note: "Traditional Shanghai breakfast; pork filling, with seafood variants to avoid.", confidence: 95 },
];

export const DISHES: Dish[] = [
  { id: "dandan", name: "Dan dan noodles", chinese: "担担面", pinyin: "dàn dàn miàn", city: "Chengdu", description: "Springy noodles dressed with chilli oil, preserved vegetables, and a savoury sesame sauce.", match: "High match · spicy + noodles", spice: 4, price: "$", warning: "Confirm the mince and broth ingredients with the vendor.", evidenceIds: ["ev-dandan"] },
  { id: "liangpi", name: "Liangpi cold noodles", chinese: "凉皮", pinyin: "liáng pí", city: "Xi'an", description: "Cool, chewy noodles sharpened with vinegar, garlic, and chilli oil.", match: "High match · street food + noodles", spice: 3, price: "$", warning: "Usually shellfish-free; sauces vary by stall.", evidenceIds: ["ev-liangpi"] },
  { id: "biang", name: "Biang biang noodles", chinese: "油泼扯面", pinyin: "yóu pō chě miàn", city: "Xi'an", description: "Wide hand-pulled noodles splashed with sizzling oil, aromatics, and chilli.", match: "High match · dramatic noodles", spice: 4, price: "$", warning: "Ask for no seafood toppings or shared garnish.", evidenceIds: ["ev-biang"] },
  { id: "roujiamo", name: "Roujiamo", chinese: "肉夹馍", pinyin: "ròu jiā mó", city: "Xi'an", description: "A crisp baked flatbread filled with richly seasoned chopped meat.", match: "Great match · portable street food", spice: 1, price: "$", warning: "Typically pork or beef; choose according to dietary needs.", evidenceIds: ["ev-roujiamo"] },
  { id: "shengjian", name: "Sheng jian bao", chinese: "生煎包", pinyin: "shēng jiān bāo", city: "Shanghai", description: "Pan-fried soup buns with a caramelised base, soft top, sesame, and scallion.", match: "Great match · iconic breakfast", spice: 1, price: "$", warning: "Choose pork-only filling; crab and prawn versions are common.", evidenceIds: ["ev-shengjian"] },
  { id: "mapo", name: "Mapo tofu", chinese: "麻婆豆腐", pinyin: "má pó dòu fu", city: "Chengdu", description: "Silken tofu in a deep red sauce with fermented bean paste and numbing pepper.", match: "Good match · maximum Sichuan flavour", spice: 5, price: "$$", warning: "Often contains minced pork; request meat-free if needed.", evidenceIds: ["ev-mapo"] },
];

export const INITIAL: Preferences = { cities: ["Shanghai", "Chengdu", "Xi'an"], loves: ["Spicy", "Noodles", "Street food"], avoids: ["Shellfish"], budget: "Mostly inexpensive", style: "Eat like a local" };
export const videoUrl = (source: Source, seconds = 0) => `https://www.youtube.com/watch?v=${source.videoId}${seconds ? `&t=${seconds}s` : ""}`;
