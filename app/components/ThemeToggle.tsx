import { useDark } from "~/hooks/useDark"

export function ThemeToggle() {
  const { toggleDark } = useDark()
  return (
    <button
      title="Toggle Dark Mode"
      className="i-ph-sun-dim-duotone dark:i-ph-moon-stars-duotone text-lg op50 hover:op75"
      onClick={toggleDark}
    />
  )
}