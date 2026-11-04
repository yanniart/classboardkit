import { h } from './dom.js';

/**
 * 모달 대화상자 (<dialog>). 확인 시 입력값(입력 모드) 또는 true, 취소 시 null.
 *
 * @param {{
 *   title: string,
 *   message?: string,
 *   input?: { value: string, label: string, maxLength?: number },
 *   confirmLabel: string,
 *   cancelLabel: string,
 *   danger?: boolean,
 * }} options
 * @returns {Promise<string | true | null>}
 */
export function openDialog({ title, message, input, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;

    /** @type {HTMLInputElement | null} */
    let field = null;
    if (input) {
      field = /** @type {HTMLInputElement} */ (
        h('input', {
          className: 'field__control',
          attrs: { type: 'text', 'aria-label': input.label, maxlength: String(input.maxLength ?? 80) },
        })
      );
      field.value = input.value;
    }

    const cancel = h('button', { className: 'button', text: cancelLabel, attrs: { type: 'button' } });
    const confirm = h('button', {
      className: `button ${danger ? 'button--danger' : 'button--primary'}`,
      text: confirmLabel,
      attrs: { type: 'button' },
    });

    const dialog = /** @type {HTMLDialogElement} */ (
      h('dialog', { className: 'dialog', attrs: { 'aria-labelledby': titleId } }, [
        h('h2', { className: 'dialog__title', text: title, attrs: { id: titleId } }),
        message ? h('p', { className: 'dialog__message', text: message }) : null,
        field,
        h('div', { className: 'dialog__actions' }, [cancel, confirm]),
      ])
    );

    /** @type {string | true | null} */
    let result = null;
    const accept = () => {
      if (field) {
        const value = field.value.trim();
        if (!value) {
          field.focus();
          return;
        }
        result = value;
      } else {
        result = true;
      }
      dialog.close();
    };

    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', accept);
    field?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        accept();
      }
    });
    // 바깥(backdrop) 클릭으로 닫기
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    document.body.append(dialog);
    dialog.showModal();
    if (field) {
      field.focus();
      field.select();
    } else {
      (danger ? cancel : confirm).focus();
    }
  });
}
