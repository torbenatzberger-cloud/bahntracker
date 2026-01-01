export interface Station {
  id: string;
  name: string;
  location?: { latitude: number; longitude: number };
}

export interface TrainStop {
  station: Station;
  arrival?: string;
  plannedArrival?: string;
  departure?: string;
  plannedDeparture?: string;
  arrivalDelay?: number;
  departureDelay?: number;
  platform?: string;
  plannedPlatform?: string;
}

export interface TrainJourney {
  tripId: string;
  trainNumber: string;
  trainType: string;
  trainName: string;
  direction: string;
  stops: TrainStop[];
  origin: TrainStop;
  destination: TrainStop;
}

export interface Trip {
  id: string;
  tripId: string;
  trainNumber: string;
  trainType: string;
  trainName: string;
  originStation: string;
  originStationId: string;
  destinationStation: string;
  destinationStationId: string;
  departurePlanned: string;
  departureActual?: string;
  arrivalPlanned: string;
  arrivalActual?: string;
  delayMinutes: number;
  distanceKm: number;
  durationMinutes: number;
  co2SavedKg: number;
  createdAt: string;
}

export interface MonthlyStats {
  month: string;
  year: number;
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalDelayMinutes: number;
  totalCo2SavedKg: number;
  averageDelay: number;
  onTimePercentage: number;
}

export interface YearlyStats {
  year: number;
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalDelayMinutes: number;
  totalCo2SavedKg: number;
  longestTrip?: Trip;
  mostDelayedTrip?: Trip;
  mostUsedRoute?: string;
  monthlyBreakdown: MonthlyStats[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}
