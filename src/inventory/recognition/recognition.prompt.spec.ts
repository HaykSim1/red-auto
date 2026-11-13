import { buildSystemPrompt, buildUserText } from './recognition.prompt';

describe('recognition prompt', () => {
  it('system prompt lists categories, brands and the no-invention rule', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('car_parts.braking_systems.brake_pads_and_shoes');
    expect(prompt).toContain('Toyota');
    expect(prompt).toContain('never invent');
  });

  it('system prompt tells the model to flag photos that show no part', () => {
    expect(buildSystemPrompt()).toContain('is_part');
  });

  it('system prompt is stable (cacheable)', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt());
  });

  it('user text carries the barcode hint', () => {
    expect(buildUserText({ barcode: '4047024063303', text: null })).toContain(
      '4047024063303',
    );
  });

  it('user text carries the text hint and omits empty hints', () => {
    const text = buildUserText({ barcode: null, text: 'front left' });
    expect(text).toContain('front left');
    expect(text).not.toMatch(/barcode/i);
  });
});
