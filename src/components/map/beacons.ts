export interface Beacon {
  name: string;
  description: string;
  lng: number;
  lat: number;
}

// Seven real-world points, one per inhabited continent-ish spread —
// literal "beacons" on the globe.
export const BEACONS: Beacon[] = [
  { name: "New York", description: "North America", lng: -74.006, lat: 40.7128 },
  { name: "London", description: "Europe", lng: -0.1278, lat: 51.5074 },
  { name: "Dubai", description: "Middle East", lng: 55.2708, lat: 25.2048 },
  { name: "Tokyo", description: "East Asia", lng: 139.6503, lat: 35.6762 },
  { name: "Sydney", description: "Oceania", lng: 151.2093, lat: -33.8688 },
  { name: "Cape Town", description: "Africa", lng: 18.4241, lat: -33.9249 },
  { name: "Rio de Janeiro", description: "South America", lng: -43.1729, lat: -22.9068 },
];
