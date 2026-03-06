## 2024-05-24 - Search Input Accessibility
**Learning:** Screen readers struggle with dynamic search results and loading states if not explicitly marked. Adding `aria-live="polite"` and `role="status"` to empty and loading state elements drastically improves the experience for assistive tech users.
**Action:** Always wrap loading spinners and "no results found" messages in `aria-live="polite"` containers for search interfaces.
