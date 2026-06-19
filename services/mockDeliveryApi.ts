export interface MockDeliveryStop {
  id: string;
  label: string;
  address: string;
  eta: string;
  status: 'pending' | 'current' | 'done' | 'issue';
}

export interface MockDeliveryFlow {
  stops: MockDeliveryStop[];
  epodStatus: string;
  codStatus: string;
  rejectionReason?: string | null;
}

// TODO: replace mock delivery flow when backend provides delivery/check-in/ePOD/COD APIs
export function getMockDeliveryFlow(orderStatus: string, destinationAddress?: string | null): MockDeliveryFlow {
  const status = orderStatus.trim().toUpperCase();
  const delivered = status === 'DELIVERED';
  const rejected = status === 'REJECTED' || status === 'CANCELLED';
  const inTransit = status === 'IN_TRANSIT' || delivered || rejected;
  const destination = destinationAddress?.trim() || 'Customer delivery address';

  return {
    stops: [
      {
        id: 'out-for-delivery',
        label: 'Out for delivery',
        address: 'ColdChainX hub dispatch gate',
        eta: '09:30',
        status: inTransit ? 'done' : 'pending',
      },
      {
        id: 'arrived-delivery',
        label: 'Arrived at delivery point',
        address: destination,
        eta: '11:30',
        status: delivered ? 'done' : inTransit ? 'current' : 'pending',
      },
      {
        id: 'receiver-confirmation',
        label: 'Waiting for receiver confirmation',
        address: destination,
        eta: '11:45',
        status: delivered ? 'done' : rejected ? 'issue' : 'pending',
      },
      {
        id: 'delivered',
        label: delivered ? 'Delivered' : rejected ? 'Rejected / Returned' : 'Delivered',
        address: destination,
        eta: '12:00',
        status: delivered ? 'done' : rejected ? 'issue' : 'pending',
      },
    ],
    epodStatus: delivered ? 'e-POD signed by receiver' : 'Waiting for receiver signature',
    codStatus: delivered ? 'COD collected' : 'COD pending if applicable',
    rejectionReason: rejected ? 'Receiver rejected the shipment. Warehouse team will confirm return handling.' : null,
  };
}
