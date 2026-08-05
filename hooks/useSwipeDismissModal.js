import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

// Swipe-down-to-dismiss gesture for bottom-sheet style modals. `onDismiss` is
// read via a ref so the PanResponder (created once) always calls the latest
// callback, even though it's captured in a single useRef on first render.
export default function useSwipeDismissModal(onDismiss) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 20 || gestureState.vy > 0.2) {
          onDismissRef.current();
          setTimeout(() => {
            translateY.setValue(0);
          }, 300);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return { translateY, panResponder };
}
