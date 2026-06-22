import Svg, { Path } from 'react-native-svg'

interface Props {
  size?: number
  color: string
  /** Colour of the checkmark cut-out; usually the surface behind the shield. */
  checkColor?: string
}

/** Crisp vector shield-with-checkmark — the MalScan mark. Replaces the old emoji glyph. */
export function ShieldIcon({ size = 48, color, checkColor = '#fff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2 L20 5 V11 C20 16.25 16.6 21.24 12 22.5 C7.4 21.24 4 16.25 4 11 V5 L12 2 Z"
        fill={color}
      />
      <Path
        d="M8.6 12.1 L11 14.5 L15.6 9.3"
        stroke={checkColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
