import React from 'react';
import { View, ViewProps } from 'react-native';

interface DoubleBezelCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  highlight?: boolean;
  accentBorder?: 'orange' | 'blue' | 'red' | 'none';
}

/**
 * Doppelrand (Double-Bezel) 機件包覆卡片
 * 符合 high-end-visual-design 與 design-taste-frontend 準則：
 * - 外層：髮絲紋邊框與機件外框 (border-white/10)
 * - 內層：深邃 OLED 碳纖核心 (bg-garage-card)，附帶細微內部光澤反射
 */
export const DoubleBezelCard: React.FC<DoubleBezelCardProps> = ({
  children,
  className = '',
  innerClassName = '',
  highlight = false,
  accentBorder = 'none',
  style,
  ...props
}) => {
  let outerBorderClass = 'border-white/10';
  if (accentBorder === 'orange') outerBorderClass = 'border-racing-orange/40';
  if (accentBorder === 'blue') outerBorderClass = 'border-racing-blue/40';
  if (accentBorder === 'red') outerBorderClass = 'border-racing-red/50';

  return (
    <View
      className={`rounded-2xl p-1 bg-white/[0.03] border ${outerBorderClass} ${className}`}
      style={style}
      {...props}
    >
      <View
        className={`rounded-[14px] bg-garage-card p-4 border border-white/[0.05] ${
          highlight ? 'bg-garage-elevated' : ''
        } ${innerClassName}`}
      >
        {children}
      </View>
    </View>
  );
};
