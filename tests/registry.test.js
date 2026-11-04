import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, prepareWidget, validateWidgetDefinition } from '../src/core/registry.js';
import { BUILT_IN_WIDGETS, createDefaultRegistry } from '../src/widgets/index.js';
import { flattenMessages } from '../src/core/i18n.js';
import { messages } from '../src/locales/index.js';

const valid = () => ({
  type: 'demo',
  version: 1,
  icon: 'plus',
  titleKey: 'widget.demo.title',
  defaultSize: { w: 0.3, h: 0.3 },
  minSize: { w: 0.1, h: 0.1 },
  createState: () => ({}),
  mount: () => ({ update() {}, destroy() {} }),
});

test('a valid definition has no errors', () => {
  assert.deepEqual(validateWidgetDefinition(valid()), []);
});

test('invalid definitions are reported', () => {
  const errors = validateWidgetDefinition({
    ...valid(),
    type: 'Bad Type',
    version: 2,
    minSize: { w: 0.5, h: 0.1 },
    mount: null,
  });
  assert.ok(errors.some((e) => e.includes('type must be')));
  assert.ok(errors.some((e) => e.includes('minSize must not exceed')));
  assert.ok(errors.some((e) => e.includes('mount must be a function')));
  assert.ok(errors.some((e) => e.includes('migrate is required')));
});

test('registry registers, lists in order and rejects duplicates', () => {
  const registry = createRegistry();
  registry.register(valid());
  registry.register({ ...valid(), type: 'other' });
  assert.deepEqual(registry.list().map((d) => d.type), ['demo', 'other']);
  assert.equal(registry.get('demo').type, 'demo');
  assert.equal(registry.get('nope'), undefined);
  assert.throws(() => registry.register(valid()), /already registered/);
  assert.throws(() => registry.register({ ...valid(), type: 'x', icon: '' }), /Invalid widget definition/);
});

test('prepareWidget: ok, migrated, unsupported', () => {
  const v2 = { ...valid(), version: 2, migrate: (s, from) => ({ ...s, from }) };
  const widget = { id: 'w_1', type: 'demo', version: 1, state: { a: 1 } };

  assert.equal(prepareWidget(valid(), widget).status, 'ok');

  const migrated = prepareWidget(v2, widget);
  assert.equal(migrated.status, 'migrated');
  assert.deepEqual(migrated.widget.state, { a: 1, from: 1 });
  assert.equal(migrated.widget.version, 2);
  assert.deepEqual(widget.state, { a: 1 }, 'input not mutated');

  assert.equal(prepareWidget(undefined, widget).status, 'unsupported');
  assert.equal(prepareWidget(valid(), { ...widget, version: 3 }).status, 'unsupported');
});

test('every built-in widget satisfies the contract and is translated', () => {
  const registry = createDefaultRegistry();
  assert.equal(registry.list().length, BUILT_IN_WIDGETS.length);
  const keys = new Set(flattenMessages(messages.en).keys());
  for (const def of BUILT_IN_WIDGETS) {
    assert.deepEqual(validateWidgetDefinition(def), [], def.type);
    assert.ok(keys.has(def.titleKey), `${def.type}: missing ${def.titleKey}`);
    const state = def.createState();
    assert.equal(typeof state, 'object');
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state, `${def.type}: state must be JSON-safe`);
    assert.ok(def.styleUrl?.endsWith('.css'), `${def.type}: styleUrl`);
  }
});
