import { useRef, useCallback, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

type Props = PressableProps & {
  children: ReactNode
  scale?: number
  style?: StyleProp<ViewStyle>
}

export default function ScalePressable({ children, scale = 0.98, style, onPress, ...props }: Props) {
  const anim = useRef(new Animated.Value(1)).current

  const handlePressIn = useCallback(() => {
    Animated.spring(anim, { toValue: scale, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
  }, [anim, scale])

  const handlePressOut = useCallback(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
  }, [anim])

  const flat = StyleSheet.flatten(style) as ViewStyle | undefined

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} {...props}>
      <Animated.View style={[flat, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
