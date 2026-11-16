/**
 * 批注原文的常驻高亮（jsdom 挂载 BadgeLayer）：
 * - 未悬停、未编辑时也渲染淡色高亮，让角标始终能对回原文；
 * - 悬停角标或打开编辑器时同一段原文切换为加深的高亮，不叠加两层；
 * - 已发送（sent）批注同样保留常驻高亮。
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BadgeLayer } from '../src/client/annotate/overlay.tsx'
import type { Annotation, AnnotationStore } from '../src/client/annotations/model.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const RECT = {
  left: 10, top: 20, width: 120, height: 20,
  right: 130, bottom: 40, x: 10, y: 20,
  toJSON: () => ({}),
} as DOMRect

let restoreRects: (() => void) | undefined
let root: Root | undefined

beforeEach(() => {
  // jsdom 不做布局，Range/Element 的 client rects 恒为空；这里给出稳定矩形，
  // 让 BadgeLayer 的裁剪、角标与高亮路径真正执行。
  const rangeDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
  const elementDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getClientRects')
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [RECT] })
  Object.defineProperty(Element.prototype, 'getClientRects', { configurable: true, value: () => [RECT] })
  restoreRects = () => {
    if (rangeDescriptor) Object.defineProperty(Range.prototype, 'getClientRects', rangeDescriptor)
    else delete (Range.prototype as { getClientRects?: unknown }).getClientRects
    if (elementDescriptor) Object.defineProperty(Element.prototype, 'getClientRects', elementDescriptor)
    else delete (Element.prototype as { getClientRects?: unknown }).getClientRects
  }
})

afterEach(() => {
  if (root !== undefined) act(() => { root!.unmount() })
  root = undefined
  restoreRects?.()
  restoreRects = undefined
  document.body.replaceChildren()
})

function annotationWith(state: Annotation['state'] = 'active'): Annotation {
  return {
    id: 1,
    number: 1,
    sessionId: 's1',
    anchorKey: 'k1',
    text: 'selected',
    anchorText: 'selected',
    occurrence: 0,
    note: '为什么选它',
    state,
    createdAt: 0,
  }
}

function storeOf(annotations: readonly Annotation[]): AnnotationStore {
  return {
    sessions: () => [...new Set(annotations.map(annotation => annotation.sessionId))],
    list: (sessionId: string) => annotations.filter(annotation => annotation.sessionId === sessionId),
  } as unknown as AnnotationStore
}

function mountMessage(): HTMLElement {
  const view = document.createElement('div')
  view.dataset.conversationSession = 's1'
  const anchor = document.createElement('div')
  anchor.dataset.chatAnchorKey = 'k1'
  const body = document.createElement('div')
  body.dataset.chatFlowKind = 'assistant-step'
  body.textContent = 'alpha selected beta'
  anchor.appendChild(body)
  view.appendChild(anchor)
  document.body.appendChild(view)
  return view
}

function mountLayer(annotation: Annotation, editingId: number | null): HTMLElement {
  mountMessage()
  const host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root!.render(
      <BadgeLayer
        store={storeOf([annotation])}
        sessionId="s1"
        cache={new Map()}
        editingId={editingId}
        onOpen={() => {}}
      />,
    )
  })
  return host
}

describe('BadgeLayer 原文高亮', () => {
  it('未悬停、未编辑时保留淡色常驻高亮', () => {
    const host = mountLayer(annotationWith(), null)
    expect(host.querySelectorAll('[data-sidenote-highlight="idle"]')).toHaveLength(1)
    expect(host.querySelectorAll('[data-sidenote-highlight="active"]')).toHaveLength(0)
  })

  it('打开编辑器时同一段原文切换为加深高亮，不重复渲染', () => {
    const annotation = annotationWith()
    const host = mountLayer(annotation, null)
    act(() => {
      root!.render(
        <BadgeLayer
          store={storeOf([annotation])}
          sessionId="s1"
          cache={new Map()}
          editingId={annotation.id}
          onOpen={() => {}}
        />,
      )
    })
    expect(host.querySelectorAll('[data-sidenote-highlight="active"]')).toHaveLength(1)
    expect(host.querySelectorAll('[data-sidenote-highlight="idle"]')).toHaveLength(0)
  })

  it('sent 批注同样保留常驻高亮', () => {
    const host = mountLayer(annotationWith('sent'), null)
    expect(host.querySelectorAll('[data-sidenote-highlight="idle"]')).toHaveLength(1)
  })
})