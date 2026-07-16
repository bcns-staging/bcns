export type BeaconStatus = "ACTIVE" | "PLANNED" | "ARCHIVED";

export interface Beacon {
  id: string;
  name: string;
  description: string;
  status: BeaconStatus;
}

export const beacons: Beacon[] = [
  {
    id: "1",
    name: "Harbor Light",
    description: "Marks the entrance to the north harbor channel.",
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "Reef Marker",
    description: "Warns vessels of the shallow reef to the east.",
    status: "ACTIVE",
  },
  {
    id: "3",
    name: "Coastal Watch",
    description: "Proposed beacon for the southern coastal survey.",
    status: "PLANNED",
  },
  {
    id: "4",
    name: "Old Pier Light",
    description: "Decommissioned after the pier was rebuilt.",
    status: "ARCHIVED",
  },
  {
    id: "5",
    name: "Tidal Gate",
    description: "Guides traffic through the tidal gate at low water.",
    status: "ACTIVE",
  },
];
