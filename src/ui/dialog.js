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

/**
 * 내용을 직접 채우는 모달 대화상자 (템플릿 고르기·공유 링크 등).
 * build가 만든 내용 아래에 닫기 버튼을 둔다. done(value)로 닫으면 그 값, 그냥 닫으면 null.
 *
 * @template T
 * @param {{
 *   title: string,
 *   closeLabel: string,
 *   className?: string,
 *   build: (body: HTMLElement, done: (value: T) => void) => void,
 * }} options
 * @returns {Promise<T | null>}
 */
export function openContentDialog({ title, closeLabel, className = '', build }) {
  return new Promise((resolve) => {
    const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;
    const body = h('div', { className: 'dialog__body' });
    const closeButton = h('button', { className: 'button', text: closeLabel, attrs: { type: 'button' } });
    const dialog = /** @type {HTMLDialogElement} */ (
      h('dialog', { className: `dialog dialog--wide ${className}`.trim(), attrs: { 'aria-labelledby': titleId } }, [
        h('h2', { className: 'dialog__title', text: title, attrs: { id: titleId } }),
        body,
        h('div', { className: 'dialog__actions' }, [closeButton]),
      ])
    );

    /** @type {T | null} */
    let result = null;
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    build(body, (value) => {
      result = value;
      dialog.close();
    });
    document.body.append(dialog);
    dialog.showModal();
    /** @type {HTMLElement | null} */ (body.querySelector('button, input, a[href]'))?.focus();
  });
}
