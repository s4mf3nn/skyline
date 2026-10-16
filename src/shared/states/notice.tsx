import type { ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import type { StaleNotice, StateNotice } from "./index";

interface StateNoticeViewProps {
  notice: StateNotice;
  onAction?: () => void;
}

/** Notice plein écran d'un état d'attente ; le bouton n'apparaît qu'avec une action et son rappel. */
export function StateNoticeView({ notice, onAction }: StateNoticeViewProps): ReactElement {
  const showAction = notice.action !== null && onAction !== undefined;
  return (
    <View
      testID={`passages-notice-${notice.kind}`}
      className="flex-1 justify-center bg-ground px-6"
      style={{ gap: 12 }}
    >
      <Text className="font-archivo text-ink" style={{ fontSize: 40, fontWeight: "800", lineHeight: 44 }}>
        {notice.title}
      </Text>
      {notice.detail === null ? null : (
        <Text className="font-archivo text-ink" style={{ fontSize: 17, fontWeight: "700" }}>
          {notice.detail}
        </Text>
      )}
      {showAction ? (
        <Pressable
          testID="passages-notice-action"
          accessibilityRole="button"
          accessibilityLabel={notice.action ?? undefined}
          onPress={onAction}
          className="self-start bg-ink px-5 justify-center"
          style={{ minHeight: 44 }}
        >
          <Text className="font-archivo text-ground" style={{ fontSize: 17, fontWeight: "800" }}>
            {notice.action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface StaleNoticeViewProps {
  screen: "passages" | "ciel";
  notice: StaleNotice;
  color?: string;
}

/** Ligne de données périmées ; `color` laisse Ciel la teinter aux couleurs de la compagnie. */
export function StaleNoticeView({ screen, notice, color }: StaleNoticeViewProps): ReactElement {
  return (
    <View testID={`data-stale-notice-${screen}`} className="px-6 py-2">
      <Text className="font-archivo text-ink" style={{ fontSize: 13, fontWeight: "700", color }}>
        {notice.text}
      </Text>
    </View>
  );
}
