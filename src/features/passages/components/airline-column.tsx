import { memo } from "react";
import { Text, View } from "react-native";
import type { Airline } from "../../../shared/airlines";
import { AirlineLivery, getLiverySource } from "../../../shared/airlines/livery";
import { AirlineTail } from "../../../shared/airlines/tail";

const TAIL_WIDTH_PT = 170;
const TAIL_HEIGHT_PT = 249;
const TAIL_LEFT_PT = -40;

interface AirlineColumnProps {
  hex: string;
  airlineName: string;
  flightLabel: string;
  aircraftType: string;
  airline: Airline;
  labelColor: string;
}

interface FieldProps {
  label: string;
  value: string;
  color: string;
}

function Field({ label, value, color }: FieldProps) {
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Text numberOfLines={1} className="font-archivo" style={{ color, fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
      <Text numberOfLines={1} className="font-archivo" style={{ color, fontSize: 15, fontWeight: "800" }}>
        {value}
      </Text>
    </View>
  );
}

/** Livrée réelle (ou dérive générique sans livrée) en bas à gauche, colonnes Compagnie, Vol et Appareil en bas à droite. */
function AirlineColumnView({ hex, airlineName, flightLabel, aircraftType, airline, labelColor }: AirlineColumnProps) {
  return (
    <>
      {getLiverySource(airline) !== null ? (
        <View
          style={{ position: "absolute", left: TAIL_LEFT_PT, bottom: 0, width: TAIL_WIDTH_PT, height: TAIL_HEIGHT_PT }}
        >
          <AirlineLivery
            airline={airline}
            testID={`passage-livery-${hex}`}
            width={TAIL_WIDTH_PT}
            height={TAIL_HEIGHT_PT}
          />
        </View>
      ) : (
        <View
          testID={`passage-tail-${hex}`}
          style={{ position: "absolute", left: TAIL_LEFT_PT, bottom: 0, width: TAIL_WIDTH_PT, height: TAIL_HEIGHT_PT }}
        >
          <AirlineTail palette={airline.tail} width={TAIL_WIDTH_PT} height={TAIL_HEIGHT_PT} />
        </View>
      )}
      <View style={{ position: "absolute", right: 22, bottom: 22, flexDirection: "row", gap: 14 }}>
        <Field label="Compagnie" value={airlineName} color={labelColor} />
        <Field label="Vol" value={flightLabel} color={labelColor} />
        <Field label="Appareil" value={aircraftType} color={labelColor} />
      </View>
    </>
  );
}

export const AirlineColumn = memo(AirlineColumnView);
