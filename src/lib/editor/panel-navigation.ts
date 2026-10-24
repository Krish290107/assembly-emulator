interface Heading { focus: (options: { preventScroll: boolean }) => void; getBoundingClientRect: () => { top: number } }
interface Scroller { scrollTop: number; getBoundingClientRect: () => { top: number }; scrollTo: (options: { top: number; behavior: 'instant' }) => void }
/** Scroll only the drawer, never the dialog or the underlying workbench. */
export function navigatePanelSection(heading: Heading | null | undefined, content: Scroller | null | undefined) {
  if (!heading || !content) return;
  heading.focus({ preventScroll: true });
  content.scrollTo({ top: content.scrollTop + heading.getBoundingClientRect().top - content.getBoundingClientRect().top, behavior: 'instant' });
}
