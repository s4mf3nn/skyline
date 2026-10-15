import { createSceneController, type SceneController, type SceneServices, type SceneView } from "./controller";

export interface SceneStore {
  /** Vue courante ; la même référence tant que le contrôleur n'a rien publié. */
  getView(): SceneView;
  /** Le premier abonné démarre le contrôleur, le dernier parti l'arrête. */
  subscribe(listener: () => void): () => void;
  refresh(): void;
}

const LOADING: SceneView = { state: { status: "loading" }, headingDeg: null };

/** Un magasin par application : un seul contrôleur partagé par tous les lecteurs de la scène (INV1). */
export function createSceneStore(services: SceneServices): SceneStore {
  const listeners = new Set<() => void>();
  let view: SceneView = LOADING;
  let controller: SceneController | null = null;

  function publish(next: SceneView): void {
    view = next;
    for (const listener of [...listeners]) listener();
  }

  return {
    getView: () => view,
    subscribe(listener) {
      listeners.add(listener);
      if (controller === null) controller = createSceneController(services, publish);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        controller?.stop();
        controller = null;
        // Sans abonné il n'y a plus de données : le prochain abonné repart d'un état de chargement.
        view = LOADING;
      };
    },
    refresh() {
      controller?.refresh();
    },
  };
}
