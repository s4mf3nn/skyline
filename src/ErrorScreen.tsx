import { Text, View } from "react-native";

// Écran affiché à la place d'un écran qui a levé une erreur.
export function ErrorScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-ground">
      <Text className="font-archivo text-xl text-ink">Une erreur est survenue.</Text>
    </View>
  );
}
