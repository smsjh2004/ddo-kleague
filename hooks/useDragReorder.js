import { useState, useRef, useEffect } from 'react';
import { Animated, PanResponder } from 'react-native';
import { storage } from '../utils/storage';

// Drag-to-reorder for a list of string keys, via a per-row drag handle.
// orderRef always mirrors the latest order so the PanResponder callbacks
// (created once per key and cached) never read a stale array.
export default function useDragReorder(order, setOrder, rowHeight, persistKey) {
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const [dragKey, setDragKey] = useState(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartIndexRef = useRef(0);
  const dragResponders = useRef({}).current;

  const getDragResponder = (key) => {
    if (!dragResponders[key]) {
      dragResponders[key] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartIndexRef.current = orderRef.current.indexOf(key);
          setDragKey(key);
          dragY.setValue(0);
        },
        onPanResponderMove: (evt, gestureState) => {
          const fromIndex = dragStartIndexRef.current;
          const shift = Math.round(gestureState.dy / rowHeight);
          const toIndex = Math.min(Math.max(fromIndex + shift, 0), orderRef.current.length - 1);
          const currentIndex = orderRef.current.indexOf(key);
          if (toIndex !== currentIndex) {
            const next = [...orderRef.current];
            next.splice(currentIndex, 1);
            next.splice(toIndex, 0, key);
            orderRef.current = next;
            setOrder(next);
          }
          // Compensate for the row's own flow-position shift so it keeps
          // tracking the finger smoothly instead of jumping on each reorder.
          dragY.setValue(gestureState.dy - (toIndex - fromIndex) * rowHeight);
        },
        onPanResponderRelease: () => {
          setDragKey(null);
          dragY.setValue(0);
          storage.setItem(persistKey, orderRef.current);
        },
        onPanResponderTerminate: () => {
          setDragKey(null);
          dragY.setValue(0);
        },
      });
    }
    return dragResponders[key];
  };

  return { dragKey, dragY, getDragResponder };
}
