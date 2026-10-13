import { Text, View } from "react-native";

// Écran d'accueil provisoire du socle : remplacé dès qu'une feature fournit un écran.
export function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-ground">
      <Text className="font-archivo text-4xl text-ink">Skyline</Text>
    </View>
  );
}
