import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type GlassWidgetProps = PropsWithChildren<
  ViewProps & {
    className?: string;
  }
>;

export function GlassWidget({ children, className = '', ...props }: GlassWidgetProps) {
  return (
    <View
      className={[
        'rounded-lg border border-white/60 bg-white/75 p-5 shadow-lg shadow-brown-dark/10',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </View>
  );
}

export default GlassWidget;
