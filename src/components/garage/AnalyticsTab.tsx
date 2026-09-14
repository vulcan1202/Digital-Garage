import React from 'react';
import { View } from 'react-native';
import { CostAnalyticsCard } from '../analytics/CostAnalyticsCard';

interface AnalyticsTabProps {
  vehicleId: number;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ vehicleId }) => {
  return (
    <View className="gap-4">
      <CostAnalyticsCard vehicleId={vehicleId} />
    </View>
  );
};
