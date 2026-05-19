import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import RuleTable from '../renderer/components/RuleTable.vue';

describe('RuleTable', () => {
  const baseRules = [
    { enabled: true, sheetName: '日报', headerRows: 3, splitColumn: 'C', outputSheetName: '', skipEmpty: true },
  ];

  function createWrapper(props) {
    return mount(RuleTable, {
      global: { plugins: [ElementPlus] },
      props,
    });
  }

  it('渲染规则列表', () => {
    const wrapper = createWrapper({
      rules: baseRules,
      sourceSheetNames: ['日报', '入库'],
      templateSheetNames: ['日报', '入库'],
    });
    expect(wrapper.exists()).toBe(true);
  });

  it('空规则列表不崩溃', () => {
    const wrapper = createWrapper({
      rules: [],
      sourceSheetNames: [],
      templateSheetNames: [],
    });
    expect(wrapper.exists()).toBe(true);
  });

  it('选中 sheet 后自动匹配 outputSheetName', () => {
    const rules = [
      { enabled: true, sheetName: '', headerRows: 3, splitColumn: 'C', outputSheetName: '', skipEmpty: true },
    ];
    const wrapper = createWrapper({
      rules,
      sourceSheetNames: ['日报', '入库'],
      templateSheetNames: ['日报', '入库'],
    });
    const vm = wrapper.vm;

    // sheetName 为空时不应自动匹配
    vm.onSheetNameChange(rules[0]);
    expect(rules[0].outputSheetName).toBe('');

    // sheetName 在模板中存在时自动匹配
    rules[0].sheetName = '日报';
    vm.onSheetNameChange(rules[0]);
    expect(rules[0].outputSheetName).toBe('日报');
  });

  it('选中 sheet 但模板中没有时，不自动匹配', () => {
    const rules = [
      { enabled: true, sheetName: '自定义Sheet', headerRows: 3, splitColumn: 'C', outputSheetName: '', skipEmpty: true },
    ];
    const wrapper = createWrapper({
      rules,
      sourceSheetNames: ['自定义Sheet'],
      templateSheetNames: ['日报', '入库'],
    });
    wrapper.vm.onSheetNameChange(rules[0]);
    expect(rules[0].outputSheetName).toBe('');
  });

  it('点击删除触发 remove 事件', () => {
    const wrapper = createWrapper({
      rules: baseRules,
      sourceSheetNames: [],
      templateSheetNames: [],
    });
    wrapper.vm.$emit('remove', 0);
    expect(wrapper.emitted('remove')).toBeTruthy();
    expect(wrapper.emitted('remove')[0]).toEqual([0]);
  });
});
