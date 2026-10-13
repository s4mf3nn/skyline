import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import "../global.css";

// Layout du socle : charge la police puis rend la route courante. Les écrans sont ajoutés par les features.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Archivo: require("../assets/fonts/Archivo-Bold.ttf") });

  // En cas d'erreur de chargement, on rend l'application avec la police système plutôt qu'un écran vide.
  if (!fontsLoaded && !fontError) {
    return null;
  }
  return <Slot />;
}
