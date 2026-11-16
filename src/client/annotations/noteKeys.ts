import type { KeyboardEvent } from 'react'

/**
 * 注解输入的统一保存快捷键：Enter 只换行，Cmd/Ctrl+Enter 才保存。
 * IME 组合中的 Enter 属于输入法，不能当确认；带修饰键的组合也交给输入法。
 */
export function saveNoteOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>, save: () => void): void {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
  event.preventDefault()
  save()
}
