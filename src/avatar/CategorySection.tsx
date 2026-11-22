/**
 * CATEGORIES + SUBCATEGORIES — THE ORGANIZATION STANDARD (owner
 * order 2026-11-22, from his live screen): the builder's options
 * were one long scroll — "I got to scroll all the way down and
 * find this and this." His order: categories with subcategories
 * inside them, consolidated, so each thing lives in exactly one
 * obvious place — in the builder first, then the same standard
 * across the whole site. Convenience and professionalism are the
 * stated purpose.
 *
 * CategorySection is that standard as one component: a labeled
 * category with a plain open/close head, and SubCategory blocks
 * inside it. A closed category unmounts its body — the scroll
 * dies, and what is open is what he is working in. Labels are
 * plain words, his words where he gave them.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CategorySection({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  /** The category's name, in plain words. */
  title: string;
  /** One short line under the head, shown while the category is open. */
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`category-section${open ? "" : " category-section--closed"}`}
      aria-label={title}
    >
      <button
        type="button"
        className="category-section__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <span>{title}</span>
      </button>
      {open && (
        <div className="category-section__body">
          {hint && <p className="category-section__hint">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

/** A subcategory inside a category: one headed home for one kind of thing. */
export function SubCategory({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="category-sub">
      <h4 className="category-sub__title">{title}</h4>
      {children}
    </div>
  );
}
