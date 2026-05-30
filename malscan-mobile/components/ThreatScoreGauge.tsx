import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { COLORS } from '../constants/theme'

const RADIUS = 72
const STROKE = 10
const SIZE = (RADIUS + STROKE) * 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = RADIUS + STROKE

// Minimum visible arc even at score 0 (2% of circumference)
const MIN_PROGRESS = 0.02

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  score: number
  color: string
}

export function ThreatScoreGauge({ score, color }: Props) {
  const progress = useSharedValue(0)

  useEffect(() => {
    const target = score === 0 ? MIN_PROGRESS : score / 100
    progress.value = withTiming(target, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    })
  }, [score])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track — visible on dark backgrounds */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#2E2E2E"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Filled arc */}
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${CENTER}, ${CENTER}`}
        />
        {/* Score number */}
        <SvgText
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          fontSize="42"
          fontWeight="bold"
          fill={color}
          fontFamily="monospace"
        >
          {score}
        </SvgText>
        {/* /100 label */}
        <SvgText
          x={CENTER}
          y={CENTER + 30}
          textAnchor="middle"
          fontSize="11"
          fill={COLORS.text.secondary}
          fontFamily="monospace"
        >
          / 100
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
