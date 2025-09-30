export type StationLocation = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  placeUrl?: string;
  note?: string;
};

export type StationEvent = {
  id: string;
  date: any;          // Firestore Timestamp
  dateStr: string;    // "YYYY-MM-DD"
  title: string;
  locationId?: string;
  location?: string;
  lat?: number;
  lng?: number;
  startTime: string;
  endTime: string;
  menuId: string;
  isPublished: boolean;
};


export type Menu = {
  id: string;
  name: string; // e.g., "Event Menu"
  sections: {
    id: string;
    title: string; // e.g., "SANDWICHES & WRAPS"
    items: {
      id: string;
      name: string;
      desc?: string;
      photoUrl?: string;
      price?: string;
    }[];
  }[];
};
