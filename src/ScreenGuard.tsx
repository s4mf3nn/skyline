import { Component, type ComponentType, type ReactNode } from "react";
import { ErrorScreen } from "./ErrorScreen";
import type { Feature } from "./shared/feature";
import { type BuildInfo, type ErrorReporter, toReport } from "./shared/monitoring";
import { useServices } from "./shared/services";

interface ErrorBoundaryProps {
  reporter: ErrorReporter;
  feature: string;
  build: BuildInfo;
  children: ReactNode;
}

// Classe, car React n'offre pas d'équivalent en hook pour attraper une erreur de rendu.
class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(thrown: unknown) {
    const { error, context } = toReport(thrown, this.props.build, this.props.feature);
    this.props.reporter.report(error, context);
  }

  override render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

/** Enveloppe un écran : une erreur de rendu est transmise au suivi et remplacée par l'écran d'erreur. */
export function guardScreen(Screen: ComponentType, feature: string, build: BuildInfo): ComponentType {
  return function GuardedScreen() {
    const { monitoring } = useServices();
    return (
      <ErrorBoundary reporter={monitoring} feature={feature} build={build}>
        <Screen />
      </ErrorBoundary>
    );
  };
}

export function guardFeatures(features: readonly Feature[], build: BuildInfo): Feature[] {
  return features.map((feature) => ({ ...feature, screen: guardScreen(feature.screen, feature.name, build) }));
}
