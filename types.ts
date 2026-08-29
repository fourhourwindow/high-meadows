// Shared domain types. Copy or symlink this file into src/types.ts on the
// frontend so both sides agree on shape — don't let them drift.

export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export type UnitType = "event_space" | "lodging";

export interface Unit {
  id: string;
  name: string; // "Venue Grounds" | "Cottage" | "Main House"
  type: UnitType;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  photos?: string[];
}

export interface Package {
  id: string;
  name: string; // "Venue Only" | "Venue + Cottage" | "Full Property Buyout"
  unitIds: string[];
  maxGuestCount: number;
  description?: string;
  photos?: string[];
  active: boolean;
}

export interface DayOfWeekRate {
  id: string; // `${packageId}_${dayOfWeek}`
  packageId: string;
  dayOfWeek: DayOfWeek;
  baseRate: number;
}

export interface SeasonalAdjustment {
  id: string;
  name: string; // "Early Peak 2027"
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
  multiplier: number; // 1.2 = +20%
  priority: number; // higher wins on overlap
  active: boolean;
}

export type DateRange = {
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
};

export type BookingStatus =
  | "held"
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "expired";

export interface PriceBreakdownNight {
  date: string; // ISO date
  dayOfWeek: DayOfWeek;
  baseRate: number;
  multiplier: number;
  nightRate: number;
}

export interface PackageSnapshot {
  packageId: string;
  name: string;
  unitIds: string[];
  dateRange: DateRange;
  nightlyBreakdown: PriceBreakdownNight[];
  totalPrice: number;
}

export interface Booking {
  id: string;
  dateRange: DateRange;
  packageSnapshot: PackageSnapshot;
  packageHistory?: PackageSnapshot[];
  clientName: string;
  email: string;
  phone: string;
  guestCount: number;
  depositAmount: number;
  depositPaid: boolean;
  balanceDue: number;
  balanceDueDate: string;
  status: BookingStatus;
  stripePaymentIntentId?: string;
  holdExpiresAt?: string; // ISO timestamp, only while status === "held"
  createdAt: string;
  updatedAt: string;
}

export type ChangeType = "upgrade" | "downgrade";
export type ChangeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface ChangeRequest {
  id: string;
  bookingId: string;
  changeType: ChangeType;
  currentPackageId: string;
  requestedPackageId: string;
  unitDelta: string[]; // units being added (upgrade) or removed (downgrade)
  priceDifference: number; // positive = owed by client, negative = refund
  status: ChangeRequestStatus;
  createdAt: string;
  expiresAt: string;
}

// availability/{unitId}/dates/{dateId} — dateId is the ISO date string
export type AvailabilityStatus = "available" | "held" | "booked" | "blocked";

export interface AvailabilityDoc {
  status: AvailabilityStatus;
  bookingId?: string;
  holdExpiresAt?: string;
}
