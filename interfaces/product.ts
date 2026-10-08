export interface Product {
  id: string;
  name: string;
  category?: string;
  price?: string;
  stock?: string;
  status?: string;
  image?: string;
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  freshness?: string;  // e.g., "1 day", "5 days"
  rating?: string;
  createdAt?: number;  // TIMESTAMP in milliseconds
}