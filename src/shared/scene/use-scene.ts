import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../services";
import { createSceneController, type SceneController, type SceneView } from "./controller";

const LOADING: SceneView = { state: { status: "loading" }, headingDeg: null };

/** Liaison React du contrôleur : toute la décision est dans `controller.ts`. */
export function useScene(): SceneView & { refresh(): void } {
  const services = useServices();
  const [view, setView] = useState<SceneView>(LOADING);
  const controllerRef = useRef<SceneController | null>(null);

  useEffect(() => {
    const controller = createSceneController(services, setView);
    controllerRef.current = controller;
    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [services]);

  const refresh = useCallback(() => controllerRef.current?.refresh(), []);

  return { ...view, refresh };
}
