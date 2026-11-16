import { documentSourceLabel, type DocumentLocation } from './document.ts'
import { t } from '../locales.ts'
import css from './annotations.module.css'

export function DocumentQuoteContent({ source, text, note }: { source: DocumentLocation; text: string; note?: string }) {
  return <div className={css.contextContent}>
    <div className={`${css.contextSource} ${css.documentSource}`} title={source.path}>{documentSourceLabel(source)}</div>
    <div className={css.documentPath}>{source.path}</div>
    <div className={css.contextText}>{text}</div>
    {note !== undefined && note.trim() !== '' && <>
      <div className={css.contextLabel}>{t('userComment')}</div>
      <div className={css.contextText}>{note}</div>
    </>}
  </div>
}
