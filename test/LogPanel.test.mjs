import { describe, it, expect } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import LogPanel from '../renderer/components/LogPanel.vue';

describe('LogPanel', () => {
  it('渲染日志行', () => {
    const wrapper = shallowMount(LogPanel, {
      props: { lines: ['第一行', '第二行', '第三行'] },
    });
    expect(wrapper.text()).toContain('第一行');
    expect(wrapper.text()).toContain('第二行');
    expect(wrapper.text()).toContain('第三行');
  });

  it('空数组时不崩溃', () => {
    const wrapper = shallowMount(LogPanel, {
      props: { lines: [] },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it('点击清空按钮触发 clear 事件', async () => {
    const wrapper = shallowMount(LogPanel, {
      props: { lines: ['log1', 'log2'] },
    });
    wrapper.vm.$emit('clear');
    expect(wrapper.emitted('clear')).toBeTruthy();
    expect(wrapper.emitted('clear').length).toBe(1);
  });
});
