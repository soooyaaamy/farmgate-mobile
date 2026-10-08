/*export type CartItem = {
  id: string;
  productId: string;

  buyerId: string;
  buyerName: string;

  farmerId?: string;
  farmName?: string;

  name: string;
  image: string;

  price: number;
  quantity: number;

  createdAt: number;
};*/
export type CartItem = {
  docId?: string;
  productId: string;
  batchId: string;
  batchNumber: number;
  buyerId: string;
  buyerName: string;
  farmerId?: string;
  farmName?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  createdAt: number;
};