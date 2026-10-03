import Svg, { Circle, Rect, Path } from 'react-native-svg'
import { useWindowDimensions } from 'react-native'

export default function HeroIllustration() {
  const { width } = useWindowDimensions()
  const svgSize = width < 480 ? 100 : 140
  const scale = svgSize / 140
  const w = 200 * scale
  const h = 160 * scale

  return (
    <Svg width={w} height={h} viewBox="0 0 200 160" fill="none">
      <Circle cx={58 * scale} cy={68 * scale} r={26 * scale} fill="#d8ff62" opacity={0.5} />
      <Circle cx={58 * scale} cy={68 * scale} r={18 * scale} fill="#d8ff62" />
      <Circle cx={142 * scale} cy={80 * scale} r={26 * scale} fill="#d8ff62" opacity={0.4} />
      <Circle cx={142 * scale} cy={80 * scale} r={18 * scale} fill="#d8ff62" />
      <Circle cx={100 * scale} cy={50 * scale} r={26 * scale} fill="#d8ff62" opacity={0.6} />
      <Circle cx={100 * scale} cy={50 * scale} r={18 * scale} fill="#d8ff62" />
      <Rect x={44 * scale} y={96 * scale} width={28 * scale} height={40 * scale} rx={8 * scale} fill="#e8efdf" stroke="#28533a" strokeWidth={1.5} />
      <Rect x={86 * scale} y={76 * scale} width={28 * scale} height={60 * scale} rx={8 * scale} fill="#e8efdf" stroke="#28533a" strokeWidth={1.5} />
      <Rect x={128 * scale} y={108 * scale} width={28 * scale} height={28 * scale} rx={8 * scale} fill="#e8efdf" stroke="#28533a" strokeWidth={1.5} />
      <Path d={`M${38 * scale} ${148 * scale}h${124 * scale}`} stroke="#d9ddd4" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={58 * scale} cy={136 * scale} r={3 * scale} fill="#28533a" />
      <Circle cx={100 * scale} cy={136 * scale} r={3 * scale} fill="#28533a" />
      <Circle cx={142 * scale} cy={136 * scale} r={3 * scale} fill="#28533a" />
    </Svg>
  )
}
