type Props = {
  name?: string;
  size?: number;
  color?: string;
};

const COLORS = ['#a11b20', '#7e1418', '#b8923d', '#4a8a5c', '#3a342d', '#5c4615'];

export function Avatar({ name = '??', size = 32, color }: Props) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || COLORS[idx],
        color: 'var(--ink-10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
