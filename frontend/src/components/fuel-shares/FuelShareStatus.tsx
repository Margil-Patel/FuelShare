import React from 'react';
import { Badge } from '@/components/ui/Badge';

export const FuelShareStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variantMap: Record<string, 'active' | 'full' | 'completed' | 'cancelled' | 'default'> = {
    ACTIVE: 'active',
    FULL: 'full',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };

  return <Badge variant={variantMap[status.toUpperCase()] || 'default'}>{status}</Badge>;
};
