import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import "../global.css";

// Layout du socle : charge la police puis rend la route courante. Les écrans sont ajoutés par les features.
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Archivo: require("../assets/fonts/Archivo-Bold.ttf") });

  if (!fontsLoaded) {
    return null;
  }
  return <Slot />;
}
