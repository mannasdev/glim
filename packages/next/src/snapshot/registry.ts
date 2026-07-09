// Assigns stable string refs ('e1', 'e2', ...) to DOM elements without mutating them.
// WeakMap keeps element -> ref without preventing garbage collection of removed nodes;
// the reverse Map holds WeakRefs so resolve() can find live elements without leaking dead ones.
export class RefRegistry {
  private refByElement = new WeakMap<Element, string>()
  private elementByRef = new Map<string, WeakRef<Element>>()
  private nextRefNumber = 1

  getRef(element: Element): string {
    const existingRef = this.refByElement.get(element)
    if (existingRef !== undefined) {
      return existingRef
    }
    const newRef = `e${this.nextRefNumber}`
    this.nextRefNumber += 1
    this.refByElement.set(element, newRef)
    this.elementByRef.set(newRef, new WeakRef(element))
    return newRef
  }

  resolve(ref: string): Element | null {
    const weakElementRef = this.elementByRef.get(ref)
    if (weakElementRef === undefined) {
      return null
    }
    return weakElementRef.deref() ?? null
  }
}
