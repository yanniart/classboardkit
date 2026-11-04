/**
 * <details class="popover"> 공통 동작:
 * - 하나를 열면 나머지는 닫힘
 * - 바깥 클릭 / Esc로 닫힘 (Esc는 summary로 포커스 복귀)
 *
 * @param {ParentNode} root
 */
export function installPopoverBehavior(root) {
  const all = () => /** @type {HTMLDetailsElement[]} */ ([...root.querySelectorAll('details.popover')]);

  for (const details of all()) {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      for (const other of all()) if (other !== details) other.open = false;
    });
  }

  document.addEventListener('pointerdown', (event) => {
    const target = /** @type {Node} */ (event.target);
    // 대화상자 위의 클릭은 무시 (팝오버에서 연 대화상자)
    if (target instanceof Element && target.closest('dialog')) return;
    for (const details of all()) if (details.open && !details.contains(target)) details.open = false;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const details of all()) {
      if (!details.open) continue;
      details.open = false;
      details.querySelector('summary')?.focus();
    }
  });
}
