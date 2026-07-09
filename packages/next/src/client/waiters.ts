import type { WaitForCondition } from '../protocol/events'

export type WaiterFactory = (
  condition: WaitForCondition,
  resolveRef: (ref: string) => Element | null,
) => { promise: Promise<string>; cancel(): void }

type RouteChangeListener = (pathname: string) => void

// Module-level registry of active route waiters. GlimProvider calls
// notifyRouteChange on every usePathname() change; each route waiter
// registered here decides whether the new pathname matches its pattern.
const routeChangeListeners = new Set<RouteChangeListener>()

export function notifyRouteChange(pathname: string): void {
  // Copy before iterating: a listener that matches removes itself from the
  // Set while we are still notifying, and mutating a Set mid-iteration of
  // itself is easy to get wrong.
  for (const routeChangeListener of [...routeChangeListeners]) {
    routeChangeListener(pathname)
  }
}

export const createWaiter: WaiterFactory = (condition, resolveRef) => {
  // Reassigned inside the promise executor (which runs synchronously) to the
  // teardown for whichever listener/observer this waiter installed. cancel()
  // calls it and never settles the promise — the engine drops the promise,
  // so leaving it forever-pending is the intended behavior.
  let removeListenersAndObservers: () => void = () => {}

  const promise = new Promise<string>((resolvePromise) => {
    if (condition.kind === 'click') {
      const documentClickHandler = (clickEvent: MouseEvent) => {
        if (condition.ref !== undefined) {
          const refElement = resolveRef(condition.ref)
          if (refElement === null) {
            return
          }
          const clickedNode = clickEvent.target
          if (!(clickedNode instanceof Node)) {
            return
          }
          if (clickedNode !== refElement && !refElement.contains(clickedNode)) {
            return
          }
        }
        removeListenersAndObservers()
        resolvePromise('the user clicked it')
      }
      // Capture phase so the waiter fires even if the host app's own handlers
      // call stopPropagation() during bubbling.
      document.addEventListener('click', documentClickHandler, true)
      removeListenersAndObservers = () => {
        document.removeEventListener('click', documentClickHandler, true)
      }
    } else if (condition.kind === 'route') {
      const routeChangeListener: RouteChangeListener = (pathname) => {
        if (pathname === condition.pattern || pathname.includes(condition.pattern)) {
          removeListenersAndObservers()
          resolvePromise('they are now on ' + pathname)
        }
      }
      routeChangeListeners.add(routeChangeListener)
      removeListenersAndObservers = () => {
        routeChangeListeners.delete(routeChangeListener)
      }
    } else {
      const documentTextIncludesConditionText = (): boolean => {
        const documentText = document.body.textContent ?? ''
        return documentText.toLowerCase().includes(condition.text.toLowerCase())
      }
      // Check once immediately: the element may already be on screen by the
      // time the model asks to wait for it.
      if (documentTextIncludesConditionText()) {
        resolvePromise('it appeared')
        return
      }
      const bodyMutationObserver = new MutationObserver(() => {
        if (documentTextIncludesConditionText()) {
          removeListenersAndObservers()
          resolvePromise('it appeared')
        }
      })
      bodyMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      })
      removeListenersAndObservers = () => {
        bodyMutationObserver.disconnect()
      }
    }
  })

  return {
    promise,
    cancel() {
      removeListenersAndObservers()
    },
  }
}
