/** La démonstration n'est choisie qu'en développement et sur demande exacte ; sinon la source réelle. */
export function chooseAdsbSource(input: { isDev: boolean; requested: string | undefined }): "demo" | "real" {
  return input.isDev && input.requested === "demo" ? "demo" : "real";
}
