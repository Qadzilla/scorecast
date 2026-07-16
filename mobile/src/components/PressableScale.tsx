import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 16, stiffness: 320, mass: 0.5 };

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
};

// A Pressable that springs down slightly on press — the tactile feedback for
// buttons, CTAs, and discrete tappable cells. Scale runs on the UI thread.
export function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
