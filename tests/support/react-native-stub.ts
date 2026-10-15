// Faux minimal de `react-native` pour Vitest : le vrai module est en syntaxe Flow et ne se charge que sous Jest.
// Il permet seulement d'importer le registre généré ; le rendu est joué par Jest (`*.native.test.tsx`).
const component = (): null => null;

export const View = component;
export const Text = component;
export const FlatList = component;
export const Pressable = component;
export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: <T>(style: T): T => style,
};
export const Platform = { OS: "ios", select: <T>(options: { ios?: T; default?: T }): T | undefined => options.ios };
