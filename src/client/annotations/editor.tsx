/**
 * 共享的批注编辑器：聊天批注与文件摘录（Add to conversation）共用同一套
 * 新建/编辑弹层、外点确认与 Esc 取消语义。放在 annotations/ 共享层，
 * annotate/overlay 与 documents/ 都从这里引用，避免 feature 之间互引。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconCheckOutline16, IconTrashOutline16 } from '../host/icons.ts'
import { t } from '../locales.ts'
import { useLocaleTick } from '../locale-tick.ts'
import type { Annotation } from './model.ts'
import { saveNoteOnShortcut } from './noteKeys.ts'
import css from '../annotate/annotate.module.css'

export interface Bounds { left: number; top: number; right: number; bottom: number }

/** 两种新建注解入口共用紧凑的多行输入高度。 */
export function useAutoGrowingNote(note: string) {
  const input = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const element = input.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 110)}px`
  }, [note])
  return input
}

/**
 * 浮层水平落点（W03）：优先锚点右侧；右侧剩余空间不足（贴着展开的
 * better-sidebar 面板时必然不足——角标 gutter 就在消息列右缘）翻到左侧。
 * 右边界取面板左缘（[data-dsh-better-sidebar]，better-sidebar 的根锚点——
 * 仅在装了它的宿主上存在，查不到按视口）。
 */
export function popoverWidth(width: number, bounds?: Bounds): number {
  return Math.min(width, Math.max(0, (bounds?.right ?? window.innerWidth) - (bounds?.left ?? 0) - 16))
}

export function popoverTop(y: number, height: number, bounds?: Bounds): number {
  return Math.max((bounds?.top ?? 0) + 8, Math.min((bounds?.bottom ?? window.innerHeight) - height, y - 20))
}

export function popoverLeft(x: number, width: number, bounds?: Bounds): number {
  const rightBound = bounds?.right ?? window.innerWidth
  const leftBound = bounds?.left ?? 0
  const preferRight = x + 16
  if (preferRight + width + 8 <= rightBound) return preferRight
  return Math.max(leftBound + 8, Math.min(rightBound - width - 8, x - width - 16))
}

/**
 * The annotation editor popover. 新建态: input + ✓ 确认 (允许空注解直接保存;
 * 点击外部 = 确认、Esc = 取消，无显式取消按钮). 重开态: 已有注解 + 🗑 删除 +
 * 取消/保存.
 *
 * 导出供单测直接挂载（tests/annotate-editor.spec.tsx），
 * 文件摘录的新建注解也复用同一编辑器（documents/index.tsx）。
 */
export function AnnotationEditor(props: {
  annotation: Annotation
  mode: 'new' | 'edit'
  x: number
  y: number
  bounds?: Bounds
  targetTitle?: string
  onSave: (note: string) => void
  onDelete: () => void
  onCancel: () => void
}): ReactNode {
  useLocaleTick()
  const [note, setNote] = useState(props.annotation.note)
  const rootRef = useRef<HTMLDivElement | null>(null)
  // 外点确认读「当前」注解：下面的 effect 是空依赖闭包，直接捕获 note 会永远停在
  // 首次渲染的值——用户敲完注解再点别处，那段注解会静默丢掉。
  const noteRef = useRef(note)
  noteRef.current = note

  const noteInputRef = useAutoGrowingNote(note)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        props.onCancel()
      }
    }
    const onMouseDown = (event: MouseEvent): void => {
      const root = rootRef.current
      if (root === null || !(event.target instanceof Node)) return
      if (root.contains(event.target)) return
      // 本插件自身的 DOM（角标/工具条）不算「外部」：点击角标由它自己的
      // click 处理器接管编辑器，不能先被外部点击取消掉。
      if (event.target instanceof Element && event.target.closest('[data-dsh-sidenote]') !== null) return
      // 新建态点外部 = 确认这一条：点输入框准备写问题是最常见的下一步动作，以前这里
      // 走 onCancel → 刚创建的注释被整条删除，用户划选的引用凭空消失（Esc 才是显式放弃）。
      // 重开态点外部仍是取消——只关编辑器，已有注解不受影响。
      if (props.mode === 'new') props.onSave(noteRef.current)
      else props.onCancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const width = popoverWidth(props.mode === 'new' ? 320 : 340, props.bounds)
  const left = popoverLeft(props.x, width, props.bounds)
  const top = popoverTop(props.y, 120, props.bounds)

  const save = (): void => { props.onSave(note) }

  if (props.mode === 'new') {
    return (
      <div ref={rootRef} className={props.targetTitle === undefined ? css.editorNew : css.editorAsk} style={{ left, top, width, maxHeight: (props.bounds?.bottom ?? window.innerHeight) - top - 8, overflowY: 'auto' }}>
        {props.targetTitle !== undefined && <div className={css.editorTarget}>{t('sendToTarget', { title: props.targetTitle })}</div>}
        <div className={css.editorAskRow} style={{ flex: 1 }}>
        <textarea
          ref={noteInputRef}
          className={css.editorInput}
          value={note}
          placeholder={t('notePlaceholder')}
          rows={1}
          autoFocus
          onChange={(event) => { setNote(event.target.value) }}
          onKeyDown={(event) => saveNoteOnShortcut(event, save)}
        />
        <button
          type="button"
          className={css.confirmButton}
          title={t('confirmTitle')}
          aria-label={t('saveNoteAria')}
          onClick={save}
        >
          <IconCheckOutline16 size={14} />
        </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className={css.editorEdit} style={{ left, top, width }}>
      {props.targetTitle !== undefined && <div className={css.editorTarget}>{t('sendToTarget', { title: props.targetTitle })}</div>}
      <textarea
        className={css.editorTextarea}
        value={note}
        placeholder={t('notePlaceholder')}
        rows={3}
        autoFocus
        onChange={(event) => { setNote(event.target.value) }}
        onKeyDown={(event) => saveNoteOnShortcut(event, save)}
      />
      <div className={css.editorFooter}>
        <button
          type="button"
          className={css.deleteButton}
          title={t('deleteNote')}
          aria-label={t('deleteNote')}
          onClick={props.onDelete}
        >
          <IconTrashOutline16 size={14} />
        </button>
        <span className={css.editorSpacer} />
        <button type="button" className={css.cancelButton} onClick={props.onCancel}>{t('cancel')}</button>
        <button type="button" className={css.saveButton} onClick={save}>{t('save')}</button>
      </div>
    </div>
  )
}