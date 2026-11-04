import en from './en.js';
import ko from './ko.js';

/** 지원 언어. 새 언어는 파일 추가 후 여기에 등록한다 */
export const messages = { en, ko };

/** 언어 선택 메뉴에 표시할 자기 언어 이름 (번역하지 않음) */
export const localeNames = {
  en: 'English',
  ko: '한국어',
};

export const FALLBACK_LOCALE = 'en';
