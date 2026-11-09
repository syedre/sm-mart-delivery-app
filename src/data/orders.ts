export type DeliveryOrder = {
  id: string;
  displayId: string;
  customerName: string;
  address: string;
  itemsCount: number;
  codAmount: number;
  note: string;
  latitude: number;
  longitude: number;
};

export const SAMPLE_ORDERS: DeliveryOrder[] = [
  {
    id: "demo-order-001",
    displayId: "SM-1042",
    customerName: "Ayesha K.",
    address: "Near BM Road, Channapatna, Karnataka",
    itemsCount: 8,
    codAmount: 645,
    note: "Please call on arrival. House is beside the medical store.",
    latitude: 12.6518,
    longitude: 77.2068
  },
  {
    id: "demo-order-002",
    displayId: "SM-1043",
    customerName: "Rahul M.",
    address: "M G Road, Channapatna, Karnataka",
    itemsCount: 5,
    codAmount: 382,
    note: "Please hand over the order at the gate.",
    latitude: 12.6542,
    longitude: 77.2051
  },
  {
    id: "demo-order-003",
    displayId: "SM-1044",
    customerName: "Naseema B.",
    address: "APMC Market Road, Channapatna, Karnataka",
    itemsCount: 11,
    codAmount: 910,
    note: "Customer prefers a phone call before delivery.",
    latitude: 12.6477,
    longitude: 77.1995
  }
];