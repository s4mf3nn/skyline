import { Text, View } from "react-native";
import { RouteBlock } from "../../../shared/routes/block";
import { useFlightInfo } from "../../../shared/routes/hooks";
import type { PassageCard } from "../service";
import { AirlineColumn } from "./airline-column";
import { DirectionArrow } from "./direction-arrow";

interface UpcomingCardProps {
  card: PassageCard;
}

/** Contenu d'une carte « prochain passage » : compte à rebours, heure de passage, direction. */
export function UpcomingCard({ card }: UpcomingCardProps) {
  const { theme } = card;
  const { aircraftType } = useFlightInfo(card.hex, card.callsign);
  return (
    <>
      <View style={{ position: "absolute", left: 18, right: 22, top: 22, gap: 10 }}>
        <Text
          className="font-archivo"
          style={{ color: theme.big, fontSize: 150, fontWeight: "800", lineHeight: 129, fontVariant: ["tabular-nums"] }}
        >
          {card.countdown}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
              Passe à
            </Text>
            <Text
              numberOfLines={1}
              className="font-archivo"
              style={{ color: theme.big, fontSize: 48, fontWeight: "800" }}
            >
              {card.passTime}
            </Text>
          </View>
          <View>
            <Text className="font-archivo" style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}>
              Regardez
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
        airline={card.airline}
        labelColor={theme.small}
      />
    </>
  );
}
