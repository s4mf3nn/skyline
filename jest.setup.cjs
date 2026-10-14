// Réglage de Reanimated pour les tests : le module natif de worklets n'existe pas sous Jest, on le remplace par son faux.
jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
require("react-native-reanimated").setUpTests();
