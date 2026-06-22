import { useEffect, useState } from 'react'
import { Dimensions, View } from 'react-native'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated'
import Svg, { Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'

const MIN_PROGRESS = 0.02
const COUNT_MS = 1300

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  score: number
  color: string
  /** Override the diameter; otherwise scales with screen width (capped). */
  size?: number
}

export function ThreatScoreGauge({ score, color, size }: Props) {
  const { colors, fonts } = useTheme()

  // Responsive: scale the ring to the device but keep it sensible on small/large screens.
  const winW = Dimensions.get('window').width
  const SIZE = size ?? Math.round(Math.min(188, Math.max(150, winW * 0.46)))
  const STROKE = Math.round(SIZE * 0.062)
  const CENTER = SIZE / 2
  const RADIUS = CENTER - STROKE
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  // Arc sweep animation
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(score <= 0 ? MIN_PROGRESS : score / 100, {
      duration: COUNT_MS + 100,
      easing: Easing.out(Easing.cubic),
    })
  }, [score])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  // Count-up of the displayed number, eased to land with the arc
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (score <= 0) { setDisplay(0); return }
    const start = Date.now()
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / COUNT_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic — matches the arc
      setDisplay(Math.round(eased * score))
      if (t >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [score])

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="scoreArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>

        {/* Soft glow halo */}
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={color} strokeWidth={STROKE + 8} fill="none" opacity={0.1} />
        {/* Track */}
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.border} strokeWidth={STROKE} fill="none" />
        {/* Animated progress arc */}
        <AnimatedCircle
          cx={CENTER} cy={CENTER} r={RADIUS}
          stroke="url(#scoreArc)" strokeWidth={STROKE} fill="none"
          strokeLinecap="round" strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          rotation="-90" origin={`${CENTER}, ${CENTER}`}
        />

        {/* Small label above the number */}
        <SvgText
          x={CENTER} y={CENTER - SIZE * 0.135} textAnchor="middle"
          fontSize={SIZE * 0.072} fill={colors.text.muted} fontFamily={fonts.body}
          letterSpacing={2}
        >
          RISK SCORE
        </SvgText>
        {/* Big count-up number */}
        <SvgText
          x={CENTER} y={CENTER + SIZE * 0.085} textAnchor="middle"
          fontSize={SIZE * 0.27} fontWeight="bold" fill={color} fontFamily={fonts.mono}
        >
          {display}
        </SvgText>
        {/* /100 */}
        <SvgText
          x={CENTER} y={CENTER + SIZE * 0.205} textAnchor="middle"
          fontSize={SIZE * 0.072} fill={colors.text.muted} fontFamily={fonts.body}
        >
          / 100
        </SvgText>
      </Svg>
    </View>
  )
}
