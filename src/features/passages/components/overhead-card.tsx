import { Text, View } from "react-native";
import { RouteBlock } from "../../../shared/routes/block";
import { useFlightInfo } from "../../../shared/routes/hooks";
import type { PassageCard } from "../service";
import { AirlineColumn } from "./airline-column";
import { DirectionArrow } from "./direction-arrow";
import { VisibilityGauge } from "./visibility-gauge";

interface OverheadCardProps {
  card: PassageCard;
}

interface ValueProps {
  label: string;
  value: string;
  card: PassageCard;
}

function Value({ label, value, card }: ValueProps) {
  return (
    <View>
      <Text className="font-archivo" style={{ color: card.theme.small, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        className="font-archivo"
        style={{ color: card.theme.big, fontSize: 48, fontWeight: "800" }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Contenu de la carte « En ce moment » : jauge de visibilité et valeurs de l'avion au-dessus. */
export function OverheadCard({ card }: OverheadCardProps) {
  const { theme, visibility } = card;
  const { aircraftType } = useFlightInfo(card.hex, card.callsign);
  return (
    <>
      <View style={{ position: "absolute", left: 18, right: 22, top: 22, gap: 10 }}>
        <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
          Au-dessus de vous
        </Text>
        <View>
          <Text className="font-archivo" style={{ color: theme.big, fontSize: 104, fontWeight: "800", lineHeight: 90 }}>
            EN CE
          </Text>
          <Text className="font-archivo" style={{ color: theme.big, fontSize: 104, fontWeight: "800", lineHeight: 90 }}>
            MOMENT
          </Text>
        </View>
        {visibility !== null && (
          <View style={{ gap: 6 }}>
            <VisibilityGauge progress={visibility.progress} theme={theme} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
                Visible encore
              </Text>
              <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
                {visibility.remaining}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Value label="Altitude" value={card.altitude} card={card} />
          <Value label="Vitesse" value={card.speed} card={card} />
          <View>
            <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
              Direction
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                numberOfLines={1}
                className="font-archivo"
                style={{ color: theme.big, fontSize: 48, fontWeight: "800" }}
              >
                {card.cardinal}
              </Text>
              <DirectionArrow hex={card.hex} angleDeg={card.arrowAngleDeg} color={theme.big} />
            </View>
          </View>
        </View>
      </View>
      <RouteBlock hex={card.hex} callsign={card.callsign} theme={theme} />
      <AirlineColumn
        hex={card.hex}
        airlineName={card.airlineName}
        flightLabel={card.flightLabel}
        aircraftType={aircraftType ?? card.aircraftType}
        tail={card.airline.tail}
        labelColor={theme.small}
      />
    </>
  );
}
