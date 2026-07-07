import React, { useRef } from 'react'
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native'

interface Props {
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/** Button wrapper that springs down slightly on press — subtle tactile feedback. */
export function PressableScale({ onPress, onLongPress, disabled, style, children }: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const animateTo = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 5 }).start()

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  )
}
