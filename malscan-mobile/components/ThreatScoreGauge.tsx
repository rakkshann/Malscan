import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'

const RADIUS = 72
const STROKE = 10
const SIZE = (RADIUS + STROKE) * 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = RADIUS + STROKE
const MIN_PROGRESS = 0.02

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props { score: number; color: string }

export function ThreatScoreGauge({ score, color }: Props) {
  const { colors, fonts } = useTheme()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(score === 0 ? MIN_PROGRESS : score / 100, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    })
  }, [score])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.border} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={CENTER} cy={CENTER} r={RADIUS}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeLinecap="round" strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          rotation="-90" origin={`${CENTER}, ${CENTER}`}
        />
        <SvgText x={CENTER} y={CENTER + 14} textAnchor="middle" fontSize="42" fontWeight="bold" fill={color} fontFamily={fonts.mono}>
          {score}
        </SvgText>
        <SvgText x={CENTER} y={CENTER + 30} textAnchor="middle" fontSize="11" fill={colors.text.muted} fontFamily={fonts.body}>
          / 100
        </SvgText>
      </Svg>
    </View>
  )
}
